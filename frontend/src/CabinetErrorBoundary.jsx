import { Component } from "react";

export class CabinetErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { failed: true, error };
  }

  componentDidCatch(error, info) {
    console.error("Cabinet render error", error, info);
    if (typeof window !== "undefined" && typeof window.__vmesteReportError === "function") {
      window.__vmesteReportError(error, { componentStack: info?.componentStack });
    }
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.failed) {
      this.setState({ failed: false, error: null });
    }
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="card full-width" style={{ margin: "1rem auto", maxWidth: 560, padding: "1.25rem" }}>
          <h2>Ошибка интерфейса</h2>
          <p className="muted">Раздел не загрузился. Попробуйте обновить страницу или вернуться на главную.</p>
          <div className="row-2" style={{ marginTop: 12 }}>
            <button type="button" className="primary-btn" onClick={() => window.location.reload()}>
              Обновить
            </button>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => {
                window.location.href = "/";
              }}
            >
              На главную
            </button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
