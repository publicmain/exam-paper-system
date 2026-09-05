# 老师词表（按周）

每周一个目录，目录名 = 那周周一的日期：

```
wordlists/2026-09-14/words.txt     叶老师给的词表（一行一个词；# 注释；word, 备注；*word 或 word! = force）
wordlists/2026-09-14/content.json  我补的释义例句（只有词表外、或库里例句差的词才需要）
```

跑法见 `docs/HANDOFF-TO-CLAUDE-2026-09-03.md` §4.10（preview → 补 content.json → publish，
发完自动 verify 出 confirm.md）。`preview.md` / `confirm.md` / `needs-content.json` 是脚本生成的，
不入库（`.gitignore`）。`_sample/` 只是格式示范，不发布。
