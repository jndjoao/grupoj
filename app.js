(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const form = $('waitlist-form');
  const submit = $('submit-btn');
  const feedback = $('form-feedback');
  const success = $('success-panel');
  const config = window.GRUPO_J_CONFIG || {};
  const endpoint = typeof config.supabaseUrl === 'string' ? config.supabaseUrl.trim().replace(/\/$/, '') : '';
  const key = typeof config.supabasePublishableKey === 'string' ? config.supabasePublishableKey.trim() : '';
  const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(endpoint)
    && /^(sb_publishable_[a-zA-Z0-9_-]+|eyJ[a-zA-Z0-9_.-]+)$/.test(key);
  const startedAt = performance.now();

  $('year').textContent = new Date().getFullYear();

  function digitsBR(value) {
    let digits = String(value || '').replace(/\D/g, '');
    if (digits.length >= 12 && digits.startsWith('55')) digits = digits.slice(2);
    return digits.slice(0, 11);
  }

  function formatPhone(digits) {
    if (digits.length < 3) return digits ? `(${digits}` : '';
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  function fieldError(id, message) {
    const field = $(id);
    field.setAttribute('aria-invalid', message ? 'true' : 'false');
    const error = $(`${id}-erro`);
    if (error) error.textContent = message;
  }

  $('whatsapp').addEventListener('input', (e) => {
    e.target.value = formatPhone(digitsBR(e.target.value));
    fieldError('whatsapp', '');
  });
  ['nome', 'cidade'].forEach((id) => {
    $(id).addEventListener('input', () => fieldError(id, ''));
  });
  $('consentimento').addEventListener('change', () => { feedback.textContent = ''; });

  function valid() {
    let ok = true;
    const name = $('nome').value.trim().replace(/\s+/g, ' ');
    const phone = digitsBR($('whatsapp').value);
    const city = $('cidade').value.trim().replace(/\s+/g, ' ');

    for (const id of ['nome', 'whatsapp', 'cidade']) fieldError(id, '');
    if (name.length < 2 || name.length > 100) {
      fieldError('nome', 'Informe seu nome.'); ok = false;
    }
    if (!/^[1-9][0-9]9[0-9]{8}$/.test(phone)) {
      fieldError('whatsapp', 'Informe um celular brasileiro com DDD (11 dígitos).'); ok = false;
    }
    if (city.length < 2 || city.length > 100) {
      fieldError('cidade', 'Informe sua cidade e estado.'); ok = false;
    }
    if (!$('consentimento').checked) {
      feedback.textContent = 'Autorize o contato sobre o lançamento para continuar.';
      ok = false;
    }
    return ok;
  }

  function utm(param) {
    return (new URLSearchParams(window.location.search).get(param) || '')
      .replace(/[\u0000-\u001f]/g, '')
      .slice(0, 120) || null;
  }

  function showSuccess() {
    form.hidden = true;
    success.hidden = false;
    success.focus();
  }

  /*
   * Códigos curtos ajudam a identificar a falha sem expor dados pessoais.
   * No console também aparecerão HTTP, código PostgREST e descrição do erro.
   * O erro deve ser resolvido pelo administrador do Supabase, não pelo cliente.
   */
  function humanError(status, errorCode) {
    if (status === 401) return 'Cadastro indisponível no momento (GJ-401). Nossa equipe precisa verificar a conexão.';
    if (status === 403 || errorCode === '42501') return 'Cadastro indisponível no momento (GJ-403). Nossa equipe precisa ajustar as permissões.';
    if (status === 404 || errorCode === '42P01' || errorCode === 'PGRST205') return 'Cadastro indisponível no momento (GJ-404). Nossa equipe precisa verificar a tabela.';
    if (status === 429) return 'Muitas tentativas neste momento. Aguarde um pouco e tente novamente (GJ-429).';
    if (status >= 500) return 'O serviço de cadastro está temporariamente indisponível (GJ-500). Tente mais tarde.';
    if (status === 400) return 'Não foi possível concluir o cadastro (GJ-400). Nossa equipe precisa verificar o banco.';
    return `Não foi possível concluir o cadastro (GJ-${status || 'ERRO'}). Tente novamente mais tarde.`;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    feedback.textContent = '';
    if (!valid()) return;

    // Barreira simples para robôs. Adicionar CAPTCHA validado no servidor em produção.
    if ($('website').value !== '') return;
    if (performance.now() - startedAt < 1500) return;

    if (!configured) {
      feedback.textContent = 'O cadastro ainda está sendo configurado (GJ-CONFIG).';
      console.error('[Grupo J] Verifique URL e chave publicável no arquivo config.js.');
      return;
    }

    const lead = {
      nome: $('nome').value.trim().replace(/\s+/g, ' '),
      whatsapp: '+55' + digitsBR($('whatsapp').value),
      cidade: $('cidade').value.trim().replace(/\s+/g, ' '),
      veiculo: $('veiculo').value.trim().slice(0, 80) || null,
      consentimento: true,
      origem: 'landing_page',
      utm_source: utm('utm_source'),
      utm_medium: utm('utm_medium'),
      utm_campaign: utm('utm_campaign'),
      utm_content: utm('utm_content'),
      utm_term: utm('utm_term')
    };

    submit.disabled = true;
    submit.textContent = 'Registrando seu interesse…';

    try {
      const response = await fetch(`${endpoint}/rest/v1/waitlist_leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': key,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(lead)
      });

      if (response.ok) {
        // Meta Pixel: conta o cadastro como Lead (só cadastros novos, não duplicados).
        if (typeof window.fbq === 'function') {
          window.fbq('track', 'Lead', { content_name: 'Lista de espera Grupo J', value: 39.90, currency: 'BRL' });
        }
        showSuccess();
        return;
      }

      // Supabase costuma responder {code, message, details, hint}; não logar o corpo inteiro
      // nem as informações do lead, pois mensagens de erro podem incluir valores privados.
      let supabaseError = {};
      try { supabaseError = await response.json(); } catch (_) { /* resposta não JSON */ }
      const code = String(supabaseError.code || 'DESCONHECIDO');
      const message = String(supabaseError.message || 'Sem descrição do servidor');

      // Se o número já estiver cadastrado, não confirmamos nem revelamos sua existência.
      // A mensagem genérica de sucesso é segura contra enumeração de números conhecidos.
      if (response.status === 409 && code === '23505' && /whatsapp/i.test(message)) {
        showSuccess();
        return;
      }

      console.error('[Grupo J] Falha no cadastro:', {
        http: response.status,
        codigo: code,
        descricao: message.replace(/\+?55\d{10,11}/g, '[telefone oculto]').slice(0, 240)
      });
      feedback.textContent = humanError(response.status, code);
    } catch (error) {
      console.error('[Grupo J] Erro de rede/CORS:', error?.name || 'erro', error?.message || '');
      feedback.textContent = 'Não foi possível conectar ao cadastro (GJ-REDE). Verifique sua internet ou tente mais tarde.';
    } finally {
      submit.disabled = false;
      submit.innerHTML = 'Garantir meu lugar na lista <span aria-hidden="true">→</span>';
    }
  });
})();
