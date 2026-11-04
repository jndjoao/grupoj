# Grupo J — Landing page de pré-lançamento

Landing page responsiva (mobile e desktop) com a identidade do Grupo J Auto App, quatro serviços, plano anunciado de **R$ 50/mês**, lista de espera e gravação de cadastros no **Supabase Postgres**.

## Arquivos

- `index.html`: site e formulário
- `styles.css`: layout, cores e responsividade
- `app.js`: validação, máscara do WhatsApp e envio ao banco
- `config.js`: **preencher** URL e chave *publishable* do Supabase
- `privacidade.html`: informações de privacidade (revisar com o responsável antes de publicar)
- `assets/`: logotipos oficiais enviados e imagem automotiva usada anteriormente, com versão otimizada
- `sql/01_criar_tabela_e_seguranca.sql`: banco + permissões de inserção + RLS

## 1. Crie/configure o banco Supabase

1. Entre em https://supabase.com/dashboard e acesse ou crie um projeto seu.
2. No projeto, abra **SQL Editor > New query**.
3. Copie o conteúdo do arquivo `sql/01_criar_tabela_e_seguranca.sql` e clique em **Run**.
4. Em **Table Editor**, a tabela `public.waitlist_leads` será criada.
5. Em **Project Settings > API Keys** (ou no painel **Connect**), copie a **Project URL** e a chave **publishable** (começa com `sb_publishable_`).

**Segurança:** o SQL deixa visitantes sem login apenas com permissão de **INSERT em colunas específicas**. Não lhes concede `SELECT`, `UPDATE` ou `DELETE`. Não use chave `sb_secret_...` ou `service_role` em arquivos públicos. O painel Supabase, acessado pelo proprietário do projeto, permite consultar os leads.

## 2. Conecte a landing page

Abra `config.js` e substitua os dois valores:

```js
window.GRUPO_J_CONFIG = {
  supabaseUrl: 'https://SEU-PROJETO.supabase.co',
  supabasePublishableKey: 'sb_publishable_SUA_CHAVE'
};
```

A chave *publishable* é pública por natureza; a proteção dos dados é feita pelas permissões e pelas políticas RLS. Sem essa configuração, o site abre normalmente, **mas não confirma inscrições**.

## 3. Teste antes de publicar

Abra um terminal na pasta do projeto:

```bash
python3 -m http.server 8080
```

Acesse http://localhost:8080 e teste o formulário com um número que você controla. No Supabase: **Table Editor > waitlist_leads**. Confirme que o cadastro apareceu e que o status é `novo`. Atualizar a página e enviar o mesmo WhatsApp não cria um segundo registro (restrição `unique`). Teste o layout em desktop e celular.

### Teste mínimo de segurança

Use uma sessão anônima para tentar consultar `GET /rest/v1/waitlist_leads?select=*` com a **publishable key**: a operação deve ser negada, pois a tabela não concede `SELECT` a `anon`. Nunca implemente uma tela pública com listagem de leads.

## 4. Publique

**Vercel / Netlify / hospedagem estática:** suba os arquivos da pasta `grupo-j-lista-espera` como site estático (sem build). Você pode importar um repositório Git contendo esses arquivos para a Vercel e selecionar **Other** em Framework Preset. Certifique-se de que `config.js` esteja preenchido e que `index.html` seja a página inicial.

Opcionalmente, cadastre um domínio ou subdomínio do Grupo J, por exemplo `espera.SEUDOMINIO.com.br`, caso o domínio seja de sua propriedade.

## 5. Acompanhe os interessados

Abra Supabase > **Table Editor > waitlist_leads**. Campos: `nome`, `whatsapp`, `cidade`, `veiculo`, `created_at`, `status`, `origem` e UTMs. Exportação em CSV está disponível pelo painel quando habilitada no projeto. O status pode ser atualizado no painel com a conta administrativa (não pela página pública).

```sql
-- Total de cadastros (rode no SQL Editor, não no site):
select count(*) as total from public.waitlist_leads;

-- Origem das campanhas:
select coalesce(utm_source, 'acesso_direto') as origem, count(*) as leads
from public.waitlist_leads
where status <> 'descadastrado'
group by 1 order by leads desc;

-- Distribuição por cidade:
select cidade, count(*) as leads
from public.waitlist_leads
where status <> 'descadastrado'
group by cidade order by leads desc;
```

### Cuidados antes de colocar tráfego pago

- Configure proteção contra spam em produção, preferencialmente **Cloudflare Turnstile validado em backend/Edge Function** e limite de requisições. O campo oculto no formulário é apenas uma barreira inicial e pode ser contornado.
- Verifique um **canal de atendimento/privacidade real** e a identificação do responsável pelos dados. Ajuste `privacidade.html` antes da publicação pública para cumprir a transparência necessária.
- Confirme com a equipe comercial as regiões atendidas e as regras de uso, de carência e de cancelamento. Esta página não promete data de lançamento ou funcionamento em cidades específicas.
- Se os dados forem usados para campanhas diferentes do aviso de lançamento, revise a base legal e as autorizações necessárias.
- Os números não são verificados por SMS/WhatsApp. Para uma lista de alta qualidade, considere confirmação de titularidade via WhatsApp oficial.

## Funcionamento do formulário

O site envia `POST` diretamente à API REST do Supabase, com `apikey: sb_publishable_...` e `Prefer: return=minimal`. Só mostra sucesso após a resposta do banco. Um número já cadastrado é tratado como inscrição já existente, sem exibir se ele consta na lista para reduzir enumeração.

**Importante:** nenhum banco de dados externo foi criado ou conectado por esta entrega. É necessário usar as suas credenciais do Supabase e executar o arquivo SQL no seu projeto.
