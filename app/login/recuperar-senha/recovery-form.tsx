import { requestPasswordRecovery } from "./actions";

export function RecoveryForm() {
  return (
    <form action={requestPasswordRecovery}>
      <div className="field">
        <label htmlFor="email">E-mail corporativo</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          maxLength={254}
          placeholder="nome@ulife.com.br"
          required
        />
      </div>
      <button className="primary-button" type="submit">
        Enviar link de recuperação
      </button>
    </form>
  );
}
