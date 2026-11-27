"use client";

import { useMemo, useState } from "react";
import { createGroupConversation } from "./actions";

type Employee = { id: string; full_name: string; email: string; department: string | null };

export function NewGroupForm({ employees }: { employees: Employee[] }) {
  const [term, setTerm] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const visibleEmployees = useMemo(() => {
    const normalized = term.trim().toLocaleLowerCase();
    if (!normalized) return employees;
    return employees.filter((employee) =>
      [employee.full_name, employee.email, employee.department ?? ""]
        .some((value) => value.toLocaleLowerCase().includes(normalized))
    );
  }, [employees, term]);

  function toggleEmployee(id: string, checked: boolean) {
    setSelected((current) => checked
      ? current.includes(id) ? current : [...current, id]
      : current.filter((item) => item !== id));
  }

  return (
    <form action={createGroupConversation} className="wa-group-form">
      <input
        className="wa-group-search"
        type="search"
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="Pesquisar nome, e-mail ou departamento"
        aria-label="Pesquisar participantes"
      />
      {selected.map((id) => <input key={id} type="hidden" name="member_ids" value={id} />)}
      <div className="wa-group-employee-list">
        {visibleEmployees.map((employee) => (
          <label className="wa-group-employee" key={employee.id}>
            <input
              type="checkbox"
              value={employee.id}
              checked={selected.includes(employee.id)}
              onChange={(event) => toggleEmployee(employee.id, event.target.checked)}
            />
            <span>
              <strong>{employee.full_name}</strong>
              <small>{employee.department || employee.email}</small>
            </span>
          </label>
        ))}
        {visibleEmployees.length === 0 && <p className="muted">Nenhum funcionário encontrado.</p>}
      </div>
      <label className="wa-group-title">
        Nome do grupo
        <input name="title" required minLength={1} maxLength={120} placeholder="Ex.: Equipe de projetos" />
      </label>
      <p className="muted">{selected.length} participante(s) selecionado(s)</p>
      <button className="primary-button" type="submit" disabled={selected.length === 0}>Criar grupo</button>
    </form>
  );
}
