# Enviar a Ordem do Dia por email

## Isto é OPCIONAL

O app já manda a OD para a equipe sem nada disto: **Compartilhar**, **Copiar** e
**Abrir no meu email** funcionam hoje, de graça, usando o WhatsApp e o email que
as pessoas já têm. É o caminho principal da tela, e para a maioria das produções
ele basta.

O que está aqui é o caminho **melhor**, não o necessário: com ele o email sai em
nome da produção (`od@suaprodutora.com.br`) em vez da conta pessoal de quem
clicou. Isso exige um domínio próprio, e domínio custa dinheiro.

⚠️ **Não existe atalho.** Nem o Vercel nem o Supabase resolvem: o Vercel não
deixa criar registros DNS no `.vercel.app` (o domínio é deles), e o email do
Supabase serve só para autenticação, com limite de poucos por hora. Enviar em
nome de um domínio que você não tem é impossível por desenho — quem recebe é
que exige a prova, e a prova mora no DNS do domínio.

Se um dia você registrar um domínio (por qualquer motivo — o app também deixaria
de morar num endereço `.vercel.app`), o passo a passo é este:

## 1. Conta no Resend

Criar em [resend.com](https://resend.com). O plano gratuito cobre 3.000 emails
por mês e 100 por dia — folgado para uma produção, que manda uma OD por diária
para umas trinta pessoas.

## 2. Verificar o domínio (o passo que evita a caixa de spam)

No painel do Resend, **Domains → Add Domain**, e apontar os registros DNS que
ele pedir (SPF, DKIM e o DMARC, se ele sugerir) no provedor do domínio.

Isso não é burocracia: sem os registros, o servidor de quem recebe não tem como
saber que o email é mesmo da produção, e o Gmail joga direto no spam. É a
diferença entre a equipe receber a OD e a equipe jurar que não recebeu.

Enquanto o domínio não estiver verificado, o Resend só entrega para o email
**da própria conta** — dá para testar, não dá para distribuir.

## 3. Guardar os segredos no Supabase

```
supabase secrets set RESEND_API_KEY=re_xxxxxxxx
supabase secrets set REMETENTE_OD="Produção <od@seudominio.com.br>"
```

O `REMETENTE_OD` precisa usar o domínio verificado no passo 2. Sem ele, a função
cai no remetente de teste do Resend (`onboarding@resend.dev`), que só entrega
para você.

⚠️ A chave nunca entra no app. Se ela chegasse ao navegador estaria no bundle,
no DevTools e no cache do service worker — e quem a pegasse mandaria email em
nome do domínio da produção.

## 4. Publicar a função

```
supabase functions deploy enviar-od
```

Rodar da **raiz do projeto** (a pasta que tem `supabase/`), senão o CLI reclama
que o caminho não existe.

## Como o envio funciona

- A equipe escalada vem pré-marcada; quem não tem email na ficha aparece num
  aviso, em vez de sumir da lista.
- Todo mundo vai em **cópia oculta**. No `to` vai o próprio remetente. Sem isso,
  cada pessoa receberia a lista de emails de toda a equipe, e um "responder a
  todos" viraria uma thread com a produção inteira dentro.
- A OD vai **no corpo do email**, em HTML, com o arquivo de agenda (`.ics`)
  anexado.

### Por que não vai um PDF anexado

A spec pedia PDF. O app nunca produziu um arquivo PDF: `imprimirHtml` abre a
caixa de impressão e quem salva o arquivo é a pessoa. Gerar um PDF de verdade no
navegador exigiria uma biblioteca que ou rasteriza o texto (fica borrado e não
dá para buscar) ou pesa mais que o app.

O corpo em HTML acabou sendo melhor para o caso real: no set as pessoas abrem o
email no celular, e ler direto vale mais que baixar um anexo. Se o PDF anexado
fizer falta, é uma decisão de acrescentar peso ao app — vale conversar antes.
