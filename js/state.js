// Estado global compartilhado da aplicação
export const state = {
  purchasesData: [],
  fichasMap: {},
  empenhosMap: {},
  notasMap: {},
  liquidacoesMap: {},
  anexosReqMap: {},
  anexosAfMap: {},
  anexosNfMap: {},
  anexosNlMap: {},
  cadLocais: [],
  cadEventos: [],
  cadAnos: [],
  currentTags: { ficha: [], empenho: [], nf: [], nl: [] },
  currentFiles: { req: [], af: [], nf: [], nl: [] },
  currentSortColumn: 'protocolo',
  currentSortDirection: 'asc'
};