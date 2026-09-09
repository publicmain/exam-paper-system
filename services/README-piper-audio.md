# 发音音频（Piper）

生成脚本：`apps/api/scripts/vendor/build-audio.py`

## 现状

学生端现在调浏览器自带的 `speechSynthesis`（指定 en-GB）。问题是音色由设备决定：
iPad 一个声音、安卓另一个，有些机器没有英式语音包就退成美音甚至不发声。单词测试
因此不敢出听音题 —— 音频不可控。

## 已经验证过的

2026-09-09 在开发机上跑通：

| | |
|---|---|
| 语音 | `en_GB-alba-medium`（英音女声，63 MB 模型） |
| 生成 | 4181 个词 **238 秒**，零失败 |
| 体积 | **140 MB**（WAV 22 kHz 单声道） |

命令：

```
python -m pip install piper-tts
cd .local/piper && python -m piper.download_voices en_GB-alba-medium
python apps/api/scripts/vendor/build-audio.py --words .local/piper/words.txt --out .local/piper/out
```

词表从生产导出（`VocabularyLexeme.headword`，只取纯字母词）。

## 卡在哪：音频放哪里

生成没有难度，**没有定的是存放和分发**。三条路，各有代价：

**一、存进 Postgres（bytea）**
- 不需要新服务，API 加一个 `/vocab/audio/:word` 路由带长缓存即可
- 代价：数据库多 140 MB；要做一次迁移和一次 140 MB 的批量上传
- 适合长期积累的词库

**二、放 Railway 卷**（API 已经挂了 `/data`）
- 不占数据库
- 代价：没有现成的上传通道，得加一个带鉴权的上传接口，或者把音频烤进镜像（镜像会变大 140 MB）

**三、只随学生端发当周的词**（约 250 个词 ≈ 9 MB）
- 最省事，静态文件跟着前端一起发
- 代价：仓库每周长 9 MB；旧词没有音频

我倾向**第一条**：一次做对，之后每周新词增量生成、增量入库，学生端只认一个 URL。
但它要动数据库迁移，得叶老师点头再做。

## 转成 mp3 能小五倍

开发机上没有 ffmpeg。装上之后 140 MB 可以压到 25–30 MB，上面三条路的代价都会小很多。
