/**
 * CONGES JRS/HNRe — API de dados (somente leitura)
 *
 * Lê as planilhas "2_INDICADORES_MENSAIS_JRS" e "ATESTADOS DE ORIGEM" e devolve,
 * em JSON, exatamente a forma dos objetos D / AO / MESES_LBL / MESES_FOOT que o
 * painel CONGES (apresentação HTML) espera — a mesma forma que hoje é digitada
 * manualmente no Claude Design a cada mês (ver readme do template).
 *
 * Esta API é SOMENTE LEITURA: não existe doPost, e nenhuma função aqui grava
 * nas planilhas-fonte. Nunca expõe nomes de inspecionados — só contagens
 * agregadas por OM (mesmo nível de agregação já usado no painel).
 *
 * Deploy: Implantar > Nova implantação > Aplicativo da web > Executar como "eu"
 * > Quem tem acesso "Qualquer pessoa". A URL /exec é pública e só responde GET.
 */

const SHEET_IND_ID = '11oTKTXMvHUWCJqWtxDJ_BvRRPA0ztNkrZIPWRgWCwfU'; // 2_INDICADORES_MENSAIS_JRS
const SHEET_AO_ID  = '1RM7YPcRAiGMsUyvlXjSjxx9kD6o4S2Ao06xU8ba10UY'; // ATESTADOS DE ORIGEM

const MESES_ABREV = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
const MESES_CAP   = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MES_NOMES_EXT = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

// cache simples em memória do processo (não entre execuções) — evita recomputar
// se o mesmo doGet acabar chamando buildPayload mais de uma vez.
let _cache = null;

function doGet(e) {
  const payload = _cache || (_cache = buildPayload());
  const json = JSON.stringify(payload);
  const callback = e && e.parameter && e.parameter.callback;
  if (callback && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(callback)) {
    // JSONP: evita qualquer dependência de cabeçalhos CORS no fetch() do GitHub Pages.
    return ContentService.createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function num_(v) {
  if (v === '' || v === null || v === undefined) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}
function idadeDias_(v) {
  const n = parseInt(String(v || '').replace(/[^0-9]/g, ''), 10);
  return isNaN(n) ? 0 : n;
}
function monthKey_(y, m) { return y + '-' + String(m).padStart(2, '0'); }
function dataValida_(v) { return v instanceof Date && !isNaN(v.getTime()); }

/** true se o Atestado de Origem já está concluído (ver LEIA-ME: Status é a fonte
 * quando presente; linhas antigas sem Status explícito são tratadas como
 * concluídas quando têm DataExSanidade preenchida). */
function aoConcluido_(row) {
  const status = String(row[10] || '').trim();
  if (status === 'Concluído') return true;
  if (status === 'Pendente') return false;
  return dataValida_(row[7]);
}

function buildPayload() {
  const ssInd = SpreadsheetApp.openById(SHEET_IND_ID);
  const dadosSheet = ssInd.getSheetByName('DADOS_MENSAIS');
  const indicSheet = ssInd.getSheetByName('INDICADORES_CPMM');
  const histSheet  = ssInd.getSheetByName('HISTORICO_TOTAL_IS_MENSAL');

  const dados = dadosSheet.getDataRange().getValues();
  const indic = indicSheet.getDataRange().getValues();
  const hist  = histSheet.getDataRange().getValues();

  const dadosRows = dados.slice(1).filter(r => r[0]);
  dadosRows.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  if (!dadosRows.length) throw new Error('DADOS_MENSAIS está vazia.');

  const lastMesAno = String(dadosRows[dadosRows.length - 1][0]);
  const anoAtual = parseInt(lastMesAno.slice(0, 4), 10);
  const rowsAno = dadosRows.filter(r => String(r[0]).slice(0, 4) === String(anoAtual));
  const NM = rowsAno.length;

  const MESES_LBL = rowsAno.map(r => {
    const mm = parseInt(String(r[0]).slice(5, 7), 10);
    return MESES_ABREV[mm - 1] + '/' + anoAtual;
  });
  const MESES_FOOT = MESES_LBL.map(s => s.replace('/', ''));

  // ---------------- D: variáveis PEP + finalidades ----------------
  const D = {
    pep1: [], pep2: [], canc: [], pep3: [], pep4: [], pep5: [], pep6: [], pep7: [],
    pep8: [], pep9: [], pep10: [], pep11: [], jrs: [], mpi: [], fin: []
  };
  rowsAno.forEach(r => {
    D.pep1.push(num_(r[3]));  D.pep2.push(num_(r[4]));
    D.mpi.push(num_(r[5]));   D.jrs.push(num_(r[6]));
    D.canc.push(num_(r[7]));
    D.pep3.push(num_(r[8]));  D.pep4.push(num_(r[9]));
    D.pep5.push(num_(r[10])); D.pep6.push(num_(r[11]));
    D.pep7.push(num_(r[12]));
    D.pep8.push(num_(r[13])); D.pep9.push(num_(r[14]));
    D.pep10.push(num_(r[15])); D.pep11.push(num_(r[16]));
    const finRow = [];
    for (let i = 0; i < 12; i++) finRow.push(num_(r[17 + i * 2]));
    D.fin.push(finRow);
  });
  D.real = D.jrs.map((v, i) => v + D.mpi[i]);
  D.abs  = D.real.map((r, i) => {
    const t = r + D.canc[i];
    return t ? +(D.canc[i] / t * 100).toFixed(2) : 0;
  });

  // ---------------- indicadores (Anexo B) — já calculados em INDICADORES_CPMM ----------------
  const mesRefByKey = {};
  indic.slice(1).forEach(row => {
    const label = String(row[0] || '').toLowerCase().trim();
    const parts = label.split('/');
    if (parts.length !== 2) return;
    const mi = MES_NOMES_EXT.indexOf(parts[0].trim());
    if (mi < 0) return;
    mesRefByKey[monthKey_(parts[1].trim(), mi + 1)] = row;
  });

  const fields = ['conc', 'damp', 'jsd', 'desn', 'ao', 'imr'];
  const clsFields = ['clsConc', 'clsDamp', 'clsJsd', 'clsDesn', 'clsAo', 'clsImr'];
  const ptFields = ['ptConc', 'ptDamp', 'ptJsd', 'ptDesn', 'ptAo', 'ptImr'];
  fields.forEach(f => D[f] = []);
  clsFields.forEach(f => D[f] = []);
  ptFields.forEach(f => D[f] = []);
  D.pts = [];

  rowsAno.forEach(r => {
    const row = mesRefByKey[String(r[0])];
    if (!row) {
      fields.forEach(f => D[f].push(0));
      clsFields.forEach(f => D[f].push('RUIM'));
      ptFields.forEach(f => D[f].push(0));
      D.pts.push(0);
      return;
    }
    D.conc.push(num_(row[1]));  D.clsConc.push(String(row[2] || 'RUIM').toUpperCase()); D.ptConc.push(num_(row[3]));
    D.damp.push(num_(row[4]));  D.clsDamp.push(String(row[5] || 'RUIM').toUpperCase()); D.ptDamp.push(num_(row[6]));
    D.jsd.push(num_(row[7]));   D.clsJsd.push(String(row[8] || 'RUIM').toUpperCase());  D.ptJsd.push(num_(row[9]));
    D.desn.push(num_(row[10])); D.clsDesn.push(String(row[11] || 'RUIM').toUpperCase()); D.ptDesn.push(num_(row[12]));
    D.ao.push(num_(row[13]));   D.clsAo.push(String(row[14] || 'RUIM').toUpperCase());  D.ptAo.push(num_(row[15]));
    D.imr.push(num_(row[16]));  D.clsImr.push(String(row[17] || 'RUIM').toUpperCase()); D.ptImr.push(num_(row[18]));
    D.pts.push(num_(row[19]));
  });
  // sobrepõe com a coluna de absenteísmo (U) já calculada na planilha, quando presente
  rowsAno.forEach((r, i) => {
    const row = mesRefByKey[String(r[0])];
    if (row && row[20] !== '' && row[20] !== null && row[20] !== undefined) D.abs[i] = num_(row[20]);
  });

  // ---------------- y2025 (linha do ano anterior) ----------------
  const histHeader = hist[0] || [];
  const colAnoAnterior = histHeader.findIndex(h => String(h).trim() === String(anoAtual - 1));
  const y2025 = [];
  for (let i = 1; i <= 12; i++) {
    const row = hist[i];
    y2025.push(colAnoAnterior >= 0 && row && row[colAnoAnterior] !== '' ? num_(row[colAnoAnterior]) : null);
  }

  // ---------------- Atestados de Origem ----------------
  const ssAO = SpreadsheetApp.openById(SHEET_AO_ID);
  const atest = ssAO.getSheetByName('AtestadosOrigem').getDataRange().getValues();
  const apur  = ssAO.getSheetByName('Apurações').getDataRange().getValues();

  const atestRows = atest.slice(1).filter(r => r[3]); // precisa ter INSPECIONADO (exclui linha-resumo)

  // janela de 13 meses terminando no último mês de DADOS_MENSAIS (mesma janela do modelo original)
  const AO_LBL = [];
  const AO_KEYS = [];
  {
    let y = anoAtual, m = parseInt(lastMesAno.slice(5, 7), 10);
    const seq = [];
    for (let k = 0; k < 13; k++) {
      seq.unshift({ y, m });
      m--; if (m < 1) { m = 12; y--; }
    }
    seq.forEach(({ y, m }) => {
      AO_KEYS.push(monthKey_(y, m));
      AO_LBL.push(MESES_CAP[m - 1] + '/' + String(y).slice(2));
    });
  }
  const AO_OFF = AO_KEYS.length - NM;

  const apurByKey = {};
  apur.slice(1).forEach(row => {
    if (dataValida_(row[0])) apurByKey[monthKey_(row[0].getFullYear(), row[0].getMonth() + 1)] = row;
  });

  const abertos = atestRows.filter(r => !aoConcluido_(r));
  const idadesAbertos = abertos.map(r => idadeDias_(r[12]));
  const estoqueAtualQtd = abertos.length;
  const idadeMediaAtual = idadesAbertos.length ? Math.round(idadesAbertos.reduce((a, b) => a + b, 0) / idadesAbertos.length) : 0;
  const idadeMaxAtual = idadesAbertos.length ? Math.max.apply(null, idadesAbertos) : 0;

  const AO = { estoque: [], recebidos: [], concluidos: [], idadeMedia: [], idadeMax: [], om: [], pendentes: [], apurado: [] };

  AO_KEYS.forEach(key => {
    const [yy, mm] = key.split('-').map(Number);
    const row = apurByKey[key];
    if (row) {
      AO.estoque.push(num_(row[3]));
      AO.recebidos.push(num_(row[4]));
      AO.concluidos.push(num_(row[5]));
      AO.idadeMedia.push(idadeDias_(row[6]));
      AO.idadeMax.push(idadeDias_(row[7]));
      AO.apurado.push(true);
    } else {
      // mês ainda sem apuração formal: estimativa a partir do estoque/fluxo atuais de
      // AtestadosOrigem (mesmo critério que o Presidente da JRS usa ao fechar o mês manualmente).
      const recebidosMes = atestRows.filter(r => dataValida_(r[1]) && r[1].getFullYear() === yy && (r[1].getMonth() + 1) === mm).length;
      const concluidosMes = atestRows.filter(r => aoConcluido_(r) && dataValida_(r[7]) && r[7].getFullYear() === yy && (r[7].getMonth() + 1) === mm).length;
      AO.estoque.push(estoqueAtualQtd);
      AO.recebidos.push(recebidosMes);
      AO.concluidos.push(concluidosMes);
      AO.idadeMedia.push(idadeMediaAtual);
      AO.idadeMax.push(idadeMaxAtual);
      AO.apurado.push(false);
    }
    const omMes = atestRows
      .filter(r => aoConcluido_(r) && dataValida_(r[7]) && r[7].getFullYear() === yy && (r[7].getMonth() + 1) === mm)
      .map(r => String(r[4] || '').trim())
      .filter(Boolean);
    AO.om.push(omMes);
  });

  const pendCont = {};
  abertos.forEach(r => {
    const om = String(r[4] || '').trim() || 'N/D';
    pendCont[om] = (pendCont[om] || 0) + 1;
  });
  AO.pendentes = Object.keys(pendCont).sort((a, b) => pendCont[b] - pendCont[a]).map(k => [k, pendCont[k]]);

  return {
    geradoEm: new Date().toISOString(),
    anoAtual, NM,
    MESES_LBL, MESES_FOOT, y2025,
    D, AO, AO_LBL, AO_OFF
  };
}

/** Função utilitária para testar manualmente no editor (Executar > testeBuildPayload). */
function testeBuildPayload() {
  Logger.log(JSON.stringify(buildPayload(), null, 2));
}
