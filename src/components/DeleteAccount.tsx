"use client";

import { useActionState, useState } from "react";
import { deleteAccount, type DeleteResult } from "@/app/actions";

export function DeleteAccount() {
  const [state, action, pending] = useActionState<DeleteResult, FormData>(deleteAccount, undefined);
  const [value, setValue] = useState("");

  return (
    <form action={action} className="delete-form">
      <label htmlFor="confirm" className="small muted">
        확인을 위해 <b>탈퇴</b>라고 입력해 주세요
      </label>
      <div className="delete-row">
        <input
          id="confirm"
          name="confirm"
          className="input"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="탈퇴"
        />
        <button type="submit" className="btn btn-danger" disabled={value !== "탈퇴" || pending}>
          {pending ? "삭제 중…" : "탈퇴하기"}
        </button>
      </div>
      {state && !state.ok && <p className="error-text">{state.error}</p>}
    </form>
  );
}
