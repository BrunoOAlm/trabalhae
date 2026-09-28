import { describe, expect, it } from 'vitest';
import { carregarMigracoes } from '../src/db/migrate';
import { migracoesEmbutidas } from '../src/db/migracoesEmbutidas';

describe('Migrações embutidas (usadas na Vercel)', () => {
  it('estão iguais aos arquivos .sql de backend/migrations', () => {
    // Se falhar: rode "npm run migracoes:embutir" no backend.
    expect(migracoesEmbutidas).toEqual(carregarMigracoes());
  });
});
