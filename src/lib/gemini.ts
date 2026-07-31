import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Projeto, Diaria, Perfil, Locacao, Departamento } from '../types';

export const gerarOrdemDoDia = async (
  apiKey: string,
  projeto: Projeto,
  diaria: Diaria,
  equipe: Perfil[],
  locacoes: Locacao[],
  departamentos: Departamento[],
  cenas: Cena[] = []
): Promise<string> => {
  if (!apiKey) throw new Error("Chave da API do Gemini não fornecida.");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const dadosDiaria = {
    projeto: projeto.nome,
    produtora: projeto.produtora || '',
    diaria_numero: diaria.numero,
    data: diaria.data,
    clima: diaria.clima ? `${diaria.clima.text}, Max: ${diaria.clima.max}°C, Min: ${diaria.clima.min}°C, Nascer do sol: ${diaria.clima.sunrise}, Pôr do sol: ${diaria.clima.sunset}` : 'Não informado',
    locacoes: locacoes.filter(l => diaria.locacoes_ids?.includes(l.id)).map(l => ({ nome: l.nome, endereco: l.endereco })),
    horarios: diaria.horarios || [],
    equipe: equipe.filter(p => diaria.equipe_escalada?.includes(p.id)).map(p => ({
      nome: `${p.nome} ${p.sobrenome || ''}`.trim(),
      funcao: p.funcao || '',
      departamento: departamentos.find(d => d.id === p.departamento_id)?.nome || 'Geral'
    })),
    cenas: [...(diaria.cenas || []), ...(diaria.cena_ids || []).map(id => cenas.find(c => c.id === id)).filter(Boolean)],
    observacoes: diaria.observacoes || ''
  };

  const prompt = `
Você é um Assistente de Direção (1º AD) diagramando uma Ordem do Dia (OD) de uma produção audiovisual.
Abaixo estão os dados reais e exatos para a Diária ${diaria.numero} do projeto "${projeto.nome}".

CRÍTICO: 
1. VOCÊ DEVE APENAS PREENCHER O TEMPLATE ABAIXO.
2. NÃO INVENTE DADOS. Se um horário não existir, não coloque. Se não tiver cenas, não crie cenas. Use APENAS os dados fornecidos.
3. Você tem permissão para redigir um pequeno parágrafo de "Sinopse do Dia" baseado nas cenas fornecidas (se houver cenas) e estruturar as "Observações".
4. Retorne APENAS o código HTML formatado. Sem marcação markdown de código (\`\`\`html), apenas o HTML puro.

Dados da Diária (JSON):
${JSON.stringify(dadosDiaria, null, 2)}

Template HTML obrigatório que você deve preencher:

<div class="od-container" style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; color: #333; line-height: 1.4;">
  
  <!-- Cabeçalho -->
  <div style="border: 2px solid #000; padding: 10px; margin-bottom: 20px; text-align: center;">
    <h1 style="margin: 0; font-size: 24px; text-transform: uppercase;">ORDEM DO DIA - DIÁRIA {{NUMERO_DA_DIARIA}}</h1>
    <h2 style="margin: 5px 0; font-size: 18px;">{{NOME_DO_PROJETO}}</h2>
    <p style="margin: 0;"><strong>Data:</strong> {{DATA_FORMATADA}} | <strong>Produtora:</strong> {{NOME_PRODUTORA}}</p>
  </div>

  <!-- Clima e Sinopse -->
  <div style="display: flex; gap: 20px; margin-bottom: 20px;">
    <div style="flex: 1; border: 1px solid #ccc; padding: 10px;">
      <h3 style="margin-top: 0; font-size: 14px; background: #eee; padding: 5px;">⛅ CLIMA (Previsão)</h3>
      <p style="font-size: 13px; margin: 0;">{{CLIMA_E_SOL}}</p>
    </div>
    <div style="flex: 2; border: 1px solid #ccc; padding: 10px;">
      <h3 style="margin-top: 0; font-size: 14px; background: #eee; padding: 5px;">🎬 SINOPSE DO DIA</h3>
      <p style="font-size: 13px; margin: 0;">{{REDIGIR_PEQUENA_SINOPSE_BASEADA_NAS_CENAS}}</p>
    </div>
  </div>

  <!-- Horários e Locações -->
  <div style="display: flex; gap: 20px; margin-bottom: 20px;">
    <!-- Cronograma -->
    <div style="flex: 1; border: 1px solid #ccc; padding: 10px;">
      <h3 style="margin-top: 0; font-size: 14px; background: #eee; padding: 5px;">⏰ CRONOGRAMA</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
        <!-- GERAR LINHAS <tr> PARA CADA HORARIO NOS DADOS -->
        <!-- Exemplo: <tr><td style="font-weight: bold; border-bottom: 1px solid #ddd;">07:00</td><td style="border-bottom: 1px solid #ddd;">Chamada Geral</td></tr> -->
      </table>
    </div>
    
    <!-- Locações -->
    <div style="flex: 1; border: 1px solid #ccc; padding: 10px;">
      <h3 style="margin-top: 0; font-size: 14px; background: #eee; padding: 5px;">📍 LOCAÇÕES / SET</h3>
      <ul style="margin:0; padding-left: 20px; font-size: 12px;">
        <!-- GERAR LISTA DE LOCACOES COM ENDERECO -->
      </ul>
    </div>
  </div>

  <!-- Ordem de Filmagem (Cenas) -->
  <div style="border: 1px solid #ccc; margin-bottom: 20px;">
    <h3 style="margin: 0; font-size: 14px; background: #eee; padding: 10px;">🎥 ORDEM DE FILMAGEM (Cenas)</h3>
    <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
      <thead>
        <tr style="background: #f9f9f9;">
          <th style="padding: 8px; border-bottom: 1px solid #ccc;">Cena</th>
          <th style="padding: 8px; border-bottom: 1px solid #ccc;">Período/Amb.</th>
          <th style="padding: 8px; border-bottom: 1px solid #ccc;">Descrição</th>
        </tr>
      </thead>
      <tbody>
        <!-- GERAR LINHAS <tr> PARA CADA CENA. SE NAO HOUVER, COLOCAR UMA LINHA DE "Nenhuma cena cadastrada" -->
      </tbody>
    </table>
  </div>

  <!-- Equipe -->
  <div style="border: 1px solid #ccc; margin-bottom: 20px;">
    <h3 style="margin: 0; font-size: 14px; background: #eee; padding: 10px;">👥 EQUIPE ESCALADA (Por Departamento)</h3>
    <div style="padding: 10px; column-count: 2; column-gap: 20px; font-size: 11px;">
      <!-- AGRUPAR EQUIPE POR DEPARTAMENTO. Exemplo: -->
      <!-- <h4 style="margin: 5px 0; color: #555;">ARTE</h4><p style="margin: 0;">João (Diretor de Arte)</p> -->
    </div>
  </div>

  <!-- Observações Gerais -->
  <div style="border: 1px solid #ccc; padding: 10px;">
    <h3 style="margin-top: 0; font-size: 14px; background: #eee; padding: 5px;">⚠️ OBSERVAÇÕES GERAIS E SEGURANÇA</h3>
    <div style="font-size: 12px;">
      {{REDIGIR_E_ORGANIZAR_AS_OBSERVACOES_FORNECIDAS}}
    </div>
  </div>
</div>
`;

  const result = await model.generateContent(prompt);
  let html = result.response.text();
  // Limpar formatação markdown que o Gemini às vezes retorna mesmo quando pedido para não retornar
  html = html.replace(/^```html/i, '').replace(/```$/i, '').trim();
  return html;
};
