(() => {
  'use strict';
  const form = document.getElementById('waitlist-form');
  const submit = document.getElementById('submit-btn');
  const feedback = document.getElementById('form-feedback');
  const success = document.getElementById('success-panel');
  const $ = (id) => document.getElementById(id);
  const CONFIG = window.GRUPO_J_CONFIG || {};
  const ready = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(CONFIG.supabaseUrl || '') &&
    /^(sb_publishable_|eyJ)[a-zA-Z0-9_.-]+$/.test(CONFIG.supabasePublishableKey || '');
  const beginAt = performance.now();

  $('year').textContent = new Date().getFullYear();

  // Máscara brasileira: o número de WhatsApp é normalizado para +55DDD9XXXXXXXX.
  function onlyBrazilianDigits(value) {
    let d = String(value || '').replace(/\D/g, '');
    if (d.length === 13 && d.startsWith('55')) d = d.slice(2);
    return d.slice(0, 11);
  }
  function formatPhone(digits) {
    if (digits.length < 3) return digits ? `(${digits}` : '';
    if (digits.length <= 7) return `(${digits.slice(0,2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
  }
  $('whatsapp').addEventListener('input', (event) => {
    event.target.value = formatPhone(onlyBrazilianDigits(event.target.value));
    showError('whatsapp', '');
  });
  ['nome','cidade'].forEach((id) => $(id).addEventListener('input', () => showError(id, '')));

  function showError(id, message) {
    const el = $(id);
    el.setAttribute('aria-invalid', message ? 'true' : 'false');
    const output = $(`${id}-erro`);
    if (output) output.textContent = message;
  }
  function valid() {
    let result = true;
    const nome = $('nome').value.trim().replace(/\s+/g, ' ');
    const phone = onlyBrazilianDigits($('whatsapp').value);
    const cidade = $('cidade').value.trim().replace(/\s+/g, ' ');
    if (nome.length < 2 || nome.length > 100) { showError('nome', 'Informe seu nome.'); result = false; }
    if (!/^[1-9][0-9]9[0-9]{8}$/.test(phone)) { showError('whatsapp', 'Informe um celular brasileiro com DDD (11 dígitos).'); result = false; }
    if (cidade.length < 2 || cidade.length > 100) { showError('cidade', 'Informe sua cidade e estado.'); result = false; }
    if (!$('consentimento').checked) { feedback.textContent = 'Autorize o contato sobre o lançamento para continuar.'; result = false; }
    return result;
  }
  function tracking(param) {
    const value = new URLSearchParams(location.search).get(param) || '';
    return value.replace(/[\u0000-\u001f]/g, '').slice(0, 120) || null;
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    feedback.textContent = '';
    if (!valid()) return;
    // Honeypot simples; não substitui CAPTCHA/rate limit em produção.
    if ($('website').value !== '') return;
    if (performance.now() - beginAt < 1500) return;
    if (!ready) { feedback.textContent = 'O cadastro ainda está sendo configurado. Tente novamente mais tarde.'; return; }

    submit.disabled = true;
    submit.innerHTML = 'Registrando seu interesse…';
    const lead = {
      nome: $('nome').value.trim().replace(/\s+/g,' '),
      whatsapp: '+55' + onlyBrazilianDigits($('whatsapp').value),
      cidade: $('cidade').value.trim().replace(/\s+/g,' '),
      veiculo: $('veiculo').value.trim().slice(0,80) || null,
      consentimento: true,
      origem: 'landing_page',
      utm_source: tracking('utm_source'),
      utm_medium: tracking('utm_medium'),
      utm_campaign: tracking('utm_campaign'),
      utm_content: tracking('utm_content'),
      utm_term: tracking('utm_term')
    };
    try {
      const response = await fetch(`${CONFIG.supabaseUrl.replace(/\/$/,'')}/rest/v1/waitlist_leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': CONFIG.supabasePublishableKey,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(lead)
      });
      // Evita revelar a terceiros se um número já se cadastrou.
      if (response.ok || response.status === 409) {
        form.hidden = true;
        success.hidden = false;
        success.focus();
      } else {
        console.error('Erro no cadastro:', response.status);
        feedback.textContent = 'Não conseguimos registrar agora. Confira os dados e tente novamente.';
      }
    } catch (err) {
      console.error('Falha de rede no cadastro:', err);
      feedback.textContent = 'Sem conexão com o cadastro. Verifique a internet e tente novamente.';
    } finally {
      submit.disabled = false;
      submit.innerHTML = 'Quero entrar na lista <span aria-hidden="true">→</span>';
    }
  });
})();
