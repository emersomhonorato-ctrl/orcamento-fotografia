import { Component } from "react";

// Se uma parte do painel der erro, mostra um aviso só nela — o resto do app continua funcionando
export default class SafeSection extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error(`[${this.props.name || "seção"}]`, error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          ⚠️ Não foi possível mostrar “{this.props.name || "esta seção"}” agora. O restante do app segue normal.
          <span className="mt-1 block text-xs text-amber-700">{String(this.state.error?.message || this.state.error)}</span>
        </div>
      );
    }
    return this.props.children;
  }
}
