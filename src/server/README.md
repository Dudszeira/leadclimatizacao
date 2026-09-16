# Data layer — padrão de erro

- Toda função exportada resolve para `Result<T>` (`src/lib/types.ts`): `{ data, error: null }` no sucesso, `{ data: null, error: "mensagem pt-BR acionável" }` na falha. Nada aqui lança exceção.
- O erro cru do Supabase nunca chega à UI: ele é logado no servidor (`console.error`) e substituído por uma mensagem amigável.
- Com `isDemoMode` (env Supabase ausente), tudo resolve das fixtures de `src/lib/fixtures/` com filtros/paginação em memória.
- Listas paginadas retornam `Paginated<T>` (`items`, `total`, `page`, `pageSize`, `pageCount`); `page` é 1-based e `pageSize` default 20.
- Getters por id retornam `Result<T | null>`: `data: null` + `error: null` significa "não encontrado" (não é falha).
