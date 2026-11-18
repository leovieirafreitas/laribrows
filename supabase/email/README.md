# E-mails de acesso (Supabase Auth)

Modelos em português com o código de 6 dígitos e o link de acesso.
Já aplicados no Supabase (SMTP próprio via Resend, remetente larissa@laribrows.com.br).
O botão usa `{{ .RedirectTo }}`, que é o endereço do site que pediu o código.

- `magic-link.html` → template "Magic Link" — assunto: "Seu código de acesso · Lari Brows"
- `confirmation.html` → template "Confirm signup" — assunto: "Bem-vinda à Lari Brows · seu código de acesso"
