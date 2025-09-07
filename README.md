# 🚀 Sync collections to *your* Postman Cloud

This repo is the **source of truth**. You can publish the collections in `services/**` to your own Postman workspace with one command.

## 1) Setup (one-time)

1. [Generate a Postman API key](https://learning.postman.com/docs/developer/postman-api/authentication/#generate-a-postman-api-key)
2. [Get your workspace ID](https://learning.postman.com/docs/collaborating-in-postman/using-workspaces/use-workspaces/#get-the-workspace-id)
3. Copy [`.env.example`](.env.example) → `.env` and fill in your values.

## 2) Run the sync

```bash
npm run sync
```

* New collections → **created** in your workspace and UID stored locally.
* Existing collections → **updated** in place.
* Local `postman-map.json` (auto-generated and already in `.gitignore`) tracks your UIDs.

## 3) Verify in Postman

* Open Postman and switch to your workspace.
* You should see one collection per file under `services/**`.
* If you make changes in Postman UI, **export** them back into the same file under `services/**`.
* Use `npm run sync` to verify your exported collection JSON and catch any errors early.

## ⚠️ Troubleshooting

* **`POST failed 400 … variable/0/type`**  
  Variable `type` must be `"string" | "number" | "boolean"`. Fix or remove it.

* **`_postman_id` problems**  
  Remove any `_postman_id` fields in `info` if present.

---

**That’s it.** Work in Git as the source of truth, run `npm run sync` after pulling, and you’ll always have your collections in your own Postman workspace.

