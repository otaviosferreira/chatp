"use client";

import { useMemo, useState } from "react";
import { startDirectConversation } from "./actions";

type Employee = { id: string; full_name: string; email: string; department: string | null };

export function NewConversationForm({ employees }: { employees: Employee[] }) {
  const [term, setTerm] = useState("");
  const [selected, setSelected] = useState("");
  const visibleEmployees = useMemo(() => {
    const normalized = term.trim().toLocaleLowerCase();
    if (!normalized) return employees;
    return employees.filter((employee) =>
      [employee.full_name, employee.email, employee.department ?? ""]
        .some((value) => value.toLocaleLowerCase().includes(normalized))
    );
  }, [employees, term]);

  return (
    <form action={startDirectConversation} className="wa-group-form">
      <input
        className="wa-group-search"
        type="search"
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="Pesquisar nome, e-mail ou departamento"
        aria-label="Pesquisar funcionário"
      />
      <input type="hidden" name="other_user_id" value={selected} />
      <div className="wa-group-employee-list">
        {visibleEmployees.map((employee) => (
          <label className="wa-group-employee" key={employee.id}>
            <input
              type="radio"
              name="selected_employee"
              value={employee.id}
              checked={selected === employee.id}
              onChange={() => setSelected(employee.id)}
            />
            <span>
              <strong>{employee.full_name}</strong>
              <small>{employee.department || employee.email}</small>
            </span>
          </label>
        ))}
        {visibleEmployees.length === 0 && <p className="muted">Nenhum funcionário encontrado.</p>}
      </div>
      <p className="muted">{selected ? "1 funcionário selecionado" : "Selecione um funcionário para continuar"}</p>
      <button className="primary-button" type="submit" disabled={!selected}>Iniciar conversa</button>
    </form>
  );
}
