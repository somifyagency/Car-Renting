import { useState } from "react";
import { api } from "../api.js";

export default function Login({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    try {
      const r = await api(`/auth/${mode}`, { method: "POST", body: f });
      localStorage.setItem("token", r.token);
      localStorage.setItem("user", JSON.stringify(r.user));
      onLogin(r.user);
    } catch (e) { setErr(e.message); }
  };

  return (
    <div className="login">
      <form onSubmit={submit}>
        <h1>Fleet Books</h1>
        <p className="sub">{mode === "login" ? "Sign in to the accounting system." : "Create the first admin account."}</p>
        {mode === "register" && <label>Name<input value={f.name} onChange={set("name")} required /></label>}
        <label>Email<input type="email" value={f.email} onChange={set("email")} required /></label>
        <label>Password<input type="password" value={f.password} onChange={set("password")} required minLength={6} /></label>
        {err && <p className="err">{err}</p>}
        <button className="btn">{mode === "login" ? "Sign in" : "Create admin"}</button>
        <button type="button" className="link" onClick={() => { setMode(mode === "login" ? "register" : "login"); setErr(""); }}>
          {mode === "login" ? "First time here? Create the admin account" : "Back to sign in"}
        </button>
      </form>
    </div>
  );
}
