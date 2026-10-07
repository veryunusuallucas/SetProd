// Checagem rápida de src/lib/coerencia.ts: `node scripts/checar-coerencia.ts`
import assert from 'node:assert/strict';
import { linhaCoerente } from '../src/lib/coerencia.ts';

const l = (o: object) => ({ projeto_id: 'A', tabela: 'tasks', id: 't1', deletado: false, dados: { id: 't1', projeto_id: 'A' }, ...o });

assert.equal(linhaCoerente(l({})), true, 'linha normal entra');
assert.equal(linhaCoerente(l({ dados: { id: 't1' } })), true, 'sem projeto_id dentro entra');
assert.equal(linhaCoerente(l({ dados: { id: 'B', projeto_id: 'A' } })), false, 'id de dentro diferente');
assert.equal(linhaCoerente(l({ dados: { id: 't1', projeto_id: 'B' } })), false, 'produção de dentro diferente');
assert.equal(linhaCoerente(l({ dados: { projeto_id: 'A' } })), false, 'sem id dentro');
assert.equal(linhaCoerente(l({ tabela: 'projetos', id: 'B', dados: { id: 'B' } })), false, 'produção com id ≠ projeto_id');
assert.equal(linhaCoerente(l({ tabela: 'projetos', id: 'A', dados: { id: 'A' } })), true, 'produção certa');
assert.equal(linhaCoerente(l({ deletado: true, dados: null })), true, 'lápide entra');
assert.equal(linhaCoerente(l({ tabela: 'projetos', id: 'B', deletado: true, dados: null })), false, 'lápide de produção com id trocado');
console.log('coerencia: ok');
