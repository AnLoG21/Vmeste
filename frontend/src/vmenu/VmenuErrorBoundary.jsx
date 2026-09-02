import { Component } from "react";
import { reportClientError } from "../monitoring.js";

export class VmenuErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    reportClientError(error, { componentStack: info?.componentStack, scope: "vmenu" });
  }

  render() {
    if (this.state.failed) {
      return (
        <section className="card vmenu-app">
          <h2>Вменю</h2>
          <p className="status error">Не удалось отобразить раздел. Попробуйте обновить страницу.</p>
          <button type="button" className="primary-btn" onClick={() => window.location.reload()}>
            Обновить
          </button>
        </section>
      );
    }
    return this.props.children;
  }
}
