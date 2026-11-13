import { Fragment, type ReactNode } from 'react'
import { template, type MessageKey, type VarArgs } from './index'

const TAG = /(<b>.*?<\/b>|<code>.*?<\/code>)/
const VARIABLE = /(\{\w+\})/

function withVars(text: string, vars: Record<string, ReactNode>): ReactNode[] {
  return text.split(VARIABLE).map((part, index) => {
    const name = VARIABLE.test(part) ? part.slice(1, -1) : null
    return name !== null && name in vars ? <Fragment key={index}>{vars[name]}</Fragment> : part
  })
}

/**
 * Texto com marcação ou com um componente no meio da frase.
 *
 * A frase inteira fica no dicionário — `<b>`, `<code>` e a posição de cada
 * `{variável}` — porque a ordem das palavras muda de um idioma para outro. As
 * variáveis podem ser elementos React.
 */
export function tRich<K extends MessageKey>(key: K, ...args: VarArgs<K, ReactNode>): ReactNode {
  const vars: Record<string, ReactNode> = args[0] ?? {}
  return template(key)
    .split(TAG)
    .map((part, index) => {
      if (part.startsWith('<b>')) return <b key={index}>{withVars(part.slice(3, -4), vars)}</b>
      if (part.startsWith('<code>')) {
        return <code key={index}>{withVars(part.slice(6, -7), vars)}</code>
      }
      return <Fragment key={index}>{withVars(part, vars)}</Fragment>
    })
}
