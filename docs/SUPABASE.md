# Operação com Supabase

## Ambiente

O projeto Supabase é `obiwxknvjvicgyrowcfz` (`https://obiwxknvjvicgyrowcfz.supabase.co`). A fonte de verdade do esquema são as migrações versionadas em `supabase/migrations/`; não edite o banco manualmente sem criar a migração correspondente.

No frontend/Vercel, configure:

```text
VITE_SUPABASE_URL=https://obiwxknvjvicgyrowcfz.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<chave publishable pública do dashboard>
```

Essas duas variáveis podem ser expostas ao bundle. A variável `SUPABASE_SERVICE_ROLE_KEY` é usada apenas pela infraestrutura da Edge Function e nunca deve aparecer em `.env`, Vite, logs ou código do cliente.

## Auth e redirects

No painel Supabase, em **Authentication → URL Configuration**, defina:

- Site URL: `https://observa-marilia.vercel.app`
- Redirect URLs: `https://observa-marilia.vercel.app/**` e `http://127.0.0.1:5173/**`

Configure SMTP antes de depender de confirmação de e-mail, convites e recuperação de senha. O cadastro público cria exclusivamente um perfil `citizen`; não há elevação de papel pelo navegador.

## Primeiro administrador (bootstrap seguro)

O primeiro administrador não é criado pela interface e não possui senha fixa. Execute este procedimento somente em um terminal de implantação ou outra máquina controlada, com a chave de serviço guardada no cofre de segredos:

```powershell
$env:SUPABASE_URL = "https://<project-ref>.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "<service-role-secreta>"
$env:BOOTSTRAP_ADMIN_EMAIL = "admin@exemplo.com"
$env:BOOTSTRAP_ADMIN_NAME = "Administração ObservaMarília" # opcional
$env:APP_URL = "https://observa-marilia.vercel.app" # obrigatório; nunca localhost em produção
npm run bootstrap:admin
```

O comando envia um convite para o e-mail definido, configura o perfil como `admin` e é idempotente para esse mesmo usuário. Depois de existir um administrador ativo, ele se recusa a promover outro e-mail. Nunca defina `SUPABASE_SERVICE_ROLE_KEY` em `.env`, `VITE_*`, Vercel pública ou no navegador.

Se o convite expirar ou tiver sido aberto em uma URL errada, reenvie uma recuperação de senha apenas para o mesmo administrador já configurado:

```powershell
$env:BOOTSTRAP_RESEND_PASSWORD = "true"
npm run bootstrap:admin
```

O link será enviado para `APP_URL` e abrirá `#/admin/login` para a definição segura de senha.

## Administração de secretarias e gestores

- Login administrativo: `#/admin/login`.
- Secretarias: `#/admin/secretarias`.
- Gestores: `#/admin/gestores`.

Somente o papel `admin` pode criar, alterar, ativar/desativar secretarias e convidar ou bloquear gestores. A Edge Function `manage-admin` valida a sessão e o papel no servidor antes de usar a chave de serviço; as tabelas também têm RLS e não expõem permissões de escrita ao cliente.

Para demonstrar: entre como administrador, cadastre (ou use) uma secretaria ativa, abra **Gestores**, envie o convite e peça ao gestor para definir a própria senha pelo e-mail. Após o login, a conta `manager` é encaminhada a `#/gestor`.

Além das variáveis da seção Ambiente, configure nos segredos da Edge Function `manage-admin`:

```text
ALLOWED_ORIGINS=https://observa-marilia.vercel.app,http://127.0.0.1:5173
SUPABASE_SERVICE_ROLE_KEY=<somente secret>
```

## Primeiro gestor legado

1. Crie a conta do responsável pelo fluxo normal de Auth.
2. No SQL Editor, identifique o usuário pelo e-mail e promova somente essa conta:

```sql
update public.profiles
set role = 'manager'
where id = (select id from auth.users where email = lower('gestor@exemplo.com'))
  and role = 'citizen';
```

3. Faça login novamente. Esse gestor pode convidar e desativar colaboradores pelo painel.

Não altere `raw_user_meta_data` para conceder papéis. As decisões de autorização são feitas pelo perfil no banco, RLS e RPCs.

## Funções Edge

- `manage-collaborator`: só aceita gestor ativo; cria convite, perfil de colaborador, matrícula/equipe e ativa/desativa acesso via Admin API.
- `geocode-marilia`: exige sessão ativa, centraliza cache no banco e limita globalmente as chamadas externas ao Nominatim.

`ALLOWED_ORIGINS` deve conter origens separadas por vírgula. No ambiente atual ela inclui `https://observa-marilia.vercel.app,http://127.0.0.1:5173`. Ajuste-a se o domínio de produção mudar.

## Segurança e dados

Todas as tabelas de domínio têm RLS habilitado. O acesso do cliente acontece por RPCs de menor privilégio:

- lista pública somente mostra campos seguros;
- cidadão cria e lê os próprios relatos;
- gestor opera o ciclo completo;
- colaborador ativo atua somente em atribuições próprias e da própria equipe.

O bucket `occurrence-media` é privado. O upload valida tipo/tamanho/caminho e a visualização usa signed URLs de 30 minutos. O banco guarda somente caminho, MIME e tamanho — nunca Base64.

## Aplicar e verificar alterações

```bash
supabase link --project-ref obiwxknvjvicgyrowcfz
supabase db push
supabase functions deploy manage-collaborator --use-api
supabase functions deploy geocode-marilia --use-api
npm run check
```

Antes de publicar uma mudança, revise **Database → Advisors** e teste ao menos: usuário anônimo, cidadão, colaborador sem atribuição, colaborador atribuído e gestor. Os RPCs públicos de leitura podem aparecer como avisos de `security definer`; eles são intencionais, sem mutação e retornam apenas o payload público.
