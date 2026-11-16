// Estado global compartilhado da aplicação
export const state = {
  purchasesData: [],
  fichasMap: {},
  empenhosMap: {},
  afMap: {},
  notasMap: {},
  liquidacoesMap: {},
  anexosReqMap: {},
  anexosAfMap: {},
  anexosNfMap: {},
  anexosNlMap: {},
  cadLocais: [],
  cadEventos: [],
  cadAnos: [],
  currentTags: { ficha: [], empenho: [], af: [], nf: [], nl: [] },
  currentFiles: { req: [], af: [], nf: [], nl: [] },
  currentSortColumn: 'protocolo',
  currentSortDirection: 'asc'
};