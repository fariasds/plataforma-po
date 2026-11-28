import type { Scenario } from '../types'
import { bugsComCriticidade } from './bugs-com-criticidade'
import { calendarioComFeriado } from './calendario-com-feriado'
import { desempenhoCincoSprints } from './desempenho-cinco-sprints'
import { entregaPeloHistorico } from './entrega-pelo-historico'
import { escopoInjetado } from './escopo-injetado'
import { fluxoDoPo } from './fluxo-do-po'
import { grupoDeProdutos } from './grupo-de-produtos'
import { planningComRemanescentes } from './planning-com-remanescentes'
import { processoCustomizado } from './processo-customizado'
import { scrumBasico } from './scrum-basico'
import { sprintVazia } from './sprint-vazia'
import { squads } from './squads'
import { vitrine } from './vitrine'

/**
 * O catálogo de Cenários. A ordem é a de `docs/cenarios.md`, e um teste confere
 * que a tabela de lá lista exatamente estes.
 */
export const SCENARIOS: readonly Scenario[] = [
  scrumBasico,
  grupoDeProdutos,
  squads,
  entregaPeloHistorico,
  escopoInjetado,
  bugsComCriticidade,
  calendarioComFeriado,
  planningComRemanescentes,
  desempenhoCincoSprints,
  processoCustomizado,
  sprintVazia,
  vitrine,
  fluxoDoPo
]
