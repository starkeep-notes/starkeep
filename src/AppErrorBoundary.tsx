import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { failed: boolean }

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State { return { failed: true } }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Starkeep could not render the notebook', error, info.componentStack)
  }

  render() {
    if (this.state.failed) return <main role="alert" className="app-error-fallback">
      <h1>Something went wrong</h1>
      <p>Your notebook is stored on this device. Reload to try opening it again.</p>
      <button type="button" onClick={() => window.location.reload()}>Reload notebook</button>
    </main>
    return this.props.children
  }
}
