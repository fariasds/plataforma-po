import { azure, baseConfig } from '../builders'
import type { Scenario } from '../types'
import { LOJA_PRODUCT, lojaProject } from './comum'

const RETRABALHO = 'Contoso.Retrabalho'
const CRITICIDADE = 'Contoso.Criticidade'

export const sprintVazia: Scenario = {
  id: 'sprint-vazia',
  titulo: 'Sprint sem nenhum item',
  prova:
    'As sprints existem no Azure, mas nenhuma tem item, nem o backlog. Com os campos ' +
    'configurados, nenhuma tela quebra: as listas chegam vazias, as médias não viram divisão ' +
    'por zero e os percentuais ficam sem valor em vez de 0%. É a diferença entre "não há ' +
    'dado" e "não está configurado", que o Cenário scrum-basico mostra do outro lado.',
  regras: ['RN-ENT-01', 'RN-BUG-02', 'RN-DES-03', 'RN-DLY-01', 'RN-PLN-02'],
  telas: ['entregas', 'bugs', 'desempenho', 'daily', 'planning'],
  anchorDate: '2026-09-29T10:00:00',
  config: baseConfig({
    products: [LOJA_PRODUCT],
    customFields: { reworkCount: RETRABALHO, criticality: CRITICIDADE },
    criticality: [{ name: 'Alta', matches: ['alta'] }],
    recurrentBugTag: '[reincidente]'
  }),
  selections: ['loja'],
  azure: azure(
    [
      lojaProject({
        customFields: [
          { name: 'Retrabalho', referenceName: RETRABALHO, type: 'integer' },
          { name: 'Criticidade', referenceName: CRITICIDADE, type: 'string' }
        ]
      })
    ],
    []
  )
}
