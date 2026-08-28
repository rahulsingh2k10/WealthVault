# Avatar API

> Reference format: this doc mirrors an OpenAPI/Swagger UI layout (Paths → Parameters →
> Responses → Schemas), in the same style as `user-creation-api.md` and `unlock-api.md`.

**Base path:** `/api/auth`
**Tags:** `Profile`

---

## Scope note

A single route updates a user's avatar after signup: `PATCH /api/auth/avatar`. It is the
only way to change a user detail outside of the OAuth login upsert — `fullName` and
`username` are never editable directly, only refreshed automatically on each login. This
route is independent of the unlock flow; it can be called before or after
`POST /api/auth/unlock`.

---

## Paths

### `PATCH /api/auth/avatar`

**Summary:** Update the current user's avatar
**Tags:** `Profile`

**Parameters**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `portfolio_session` | cookie | string | yes | iron-session cookie; must contain `userId`. Missing or expired → `401`. |

**Request body** — `application/json`

| Field | Type | Required | Description |
|---|---|---|---|
| `avatar` | string | yes | A base64 data URL (`data:image/...;base64,...`). Must be under ~500,000 characters (~350 KB of image data). |

**Responses**

| Status | Body | When |
|---|---|---|
| `200` | `{ "success": true }` | Avatar saved |
| `400` | `{ "error": "Invalid avatar data" }` | `avatar` field missing, or doesn't start with `data:image/` |
| `400` | `{ "error": "Image too large (max ~350 KB)" }` | `avatar` string exceeds ~500,000 characters |
| `401` | `{ "error": "Unauthorized" }` | No valid session (`session.userId` missing) |

---

## Schemas

### `AvatarUpdateResult` schema

```typescript
{ success: true }
```

Always this exact shape on success — there is no partial-success case.

---

## Database effect

This route touches exactly one column: `users.avatar`.

| Case | Write |
|---|---|
| Valid avatar, valid session | `UPDATE users SET avatar = <data URL> WHERE id = :userId` |
| Invalid avatar data (400) | None — fails before the update |
| Oversized avatar (400) | None — fails before the update |
| No valid session (401) | None |

No other column on `users`, and no other table, is touched by this route.

The route also writes the same value to `session.userAvatar` (the sealed
`portfolio_session` cookie) immediately after the database write, so the two stay in
sync for the remainder of the session without a page reload.

---

## Implementation notes

| File | Role |
|---|---|
| `src/app/api/auth/avatar/route.ts` | `PATCH /api/auth/avatar` |
| `src/lib/session.ts` | `getSession()` — reads `userId`, writes `userAvatar` back on success |
