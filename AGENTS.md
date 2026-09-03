## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## icons / emoji policy

Do NOT use emojis anywhere in this repo — no emojis in code, UI, comments, docs, commit messages, or chat output. This was enforced in a repo-wide emoji purge (2026-09); do not reintroduce them.

- UI: use `lucide-react-native` icons with `ThemeContext` colors and `spacing`/`typography` tokens, not unicode symbols (no emoji glyphs). Map merchant/category/status to icon components (e.g. `ShoppingCart`/`Home`/`Lightbulb`/`Car`/`HeartPulse`/`GraduationCap`/`Film`/`Sparkles`/`Package`/`Utensils`/`Heart`/`Plane`/`Bus`/`FileText`/`HardHat`/`Sprout`/`Circle`/`CircleDot`/`Check`/`X`/`Search`/`ShieldCheck`/`Info`), render as `<Icon size={...} color={colors.*} strokeWidth={2} />`.
- Docs/README: use text badges (`[DONE]` / `[IN PROGRESS]` / `[PENDING]`) instead of emoji status markers.
- Enforcement: before committing, run the emoji scan `python3 -c "import pathlib, re; p=re.compile('[\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0001F900-\U0001F9FF\u2700-\u27BF\U0000FE0F\U0001F1E6-\U0001F1FF]'); print([str(f) for f in pathlib.Path('.').rglob('*') if f.is_file() and 'node_modules' not in str(f) and '.git' not in str(f) and not str(f).endswith(('.png','.jpg','.jpeg','.webp','.pdf','.pptx','.docx','.zip')) and p.search(f.read_text(encoding='utf-8', errors='ignore'))])"` — it must print `[]`. Treat any emoji as a blocking lint error.
