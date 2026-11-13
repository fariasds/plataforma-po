import type { ConfigurationIssue } from '@shared/config/validate'

/** Problemas de validação com o caminho no JSON, como a IA do PO também os lê. */
export function IssueList({ issues }: { issues: ConfigurationIssue[] }): React.JSX.Element {
  return (
    <ul style={{ paddingLeft: 20, margin: '8px 0 0' }}>
      {issues.map((issue, index) => (
        <li key={index}>
          {issue.path && <code>{issue.path}</code>}
          {issue.path && ': '}
          {issue.message}
        </li>
      ))}
    </ul>
  )
}
