"""
Homework v2 production smoke: 14 end-to-end assertions covering regions,
rubric items, retroactive re-score, annotations, notifications, regrades,
analytics, CSV and the mistake book.

Usage:
  HW_SMOKE_API=... HW_SMOKE_ADMIN_PW=... HW_SMOKE_STUDENT_PW=...   HW_SMOKE_HW=<homeworkId> HW_SMOKE_ASG=<assignmentId> python scripts/homework-v2-smoke.py

Creates grades/regrades/notifications on the target assignment — use a
dedicated test class, never a real one.
"""
# v2 全链路生产回归：题区/评分项/追溯/批注/通知/申诉/学情/CSV/错题本
import json, urllib.request, io, sys

import os
API = os.environ.get("HW_SMOKE_API", "http://localhost:4000")
ADMIN = os.environ.get("HW_SMOKE_ADMIN", "admin@school.local")
ADMIN_PW = os.environ["HW_SMOKE_ADMIN_PW"]
STUDENT = os.environ.get("HW_SMOKE_STUDENT", "test-student@school.local")
STUDENT_PW = os.environ["HW_SMOKE_STUDENT_PW"]
HW = os.environ["HW_SMOKE_HW"]
ASG = os.environ["HW_SMOKE_ASG"]
PASS, FAIL = [], []

def call(m, p, t=None, b=None, raw=False):
    d = json.dumps(b).encode("ascii") if b is not None else None
    r = urllib.request.Request(API + p, data=d, method=m)
    r.add_header("Content-Type", "application/json")
    if t: r.add_header("Authorization", "Bearer " + t)
    with urllib.request.urlopen(r) as x:
        body = x.read()
        if raw: return body
        return json.loads(body.decode()) if body else None

def check(name, cond, detail=""):
    (PASS if cond else FAIL).append(name)
    print(("PASS " if cond else "FAIL ") + name + (f"  {detail}" if detail and not cond else ""))

T = call("POST", "/api/auth/login", b={"email": ADMIN, "password": ADMIN_PW})["token"]
ST = call("POST", "/api/auth/login", b={"email": STUDENT, "password": STUDENT_PW})["token"]
CLASS = None

# 0) find class + worksheet file id
hw = call("GET", f"/api/homework/{HW}", T)
fileId = hw["files"][0]["id"]

# 1) rubric with regions/items/topic
rub = call("PUT", f"/api/homework/{HW}/rubric", T, {"questions": [
    {"label": "Q1", "maxMarks": 3, "criteria": "2^x=32 -> x=5", "topic": "指数方程",
     "regions": [{"fileId": fileId, "page": 1, "x": 0.05, "y": 0.10, "w": 0.9, "h": 0.25}],
     "items": [{"id": "m1", "label": "方法正确", "delta": 2}, {"id": "a1", "label": "答案正确", "delta": 1}]},
    {"label": "Q2", "maxMarks": 4, "criteria": "dy/dx=6x+2", "topic": "求导",
     "regions": [{"fileId": fileId, "page": 1, "x": 0.05, "y": 0.40, "w": 0.9, "h": 0.3}],
     "items": [{"id": "m2", "label": "求导法则正确", "delta": 3}, {"id": "u2", "label": "书写不规范", "delta": -1}]},
]})
check("rubric saves regions/items/topic",
      rub[0].get("topic") == "指数方程" and rub[0].get("regions") and rub[0].get("items"))
q1, q2 = rub[0]["id"], rub[1]["id"]

# 2) re-assign -> student gets hw_assigned notification
klass = [c for c in call("GET", "/api/classes", T) if c["classCode"] == "HWTEST"][0]
call("POST", f"/api/homework/{HW}/assign", T, {"classId": klass["id"]})
n = call("GET", "/api/notifications", ST)
check("assign notification reaches student",
      any(x["type"] == "hw_assigned" for x in n["items"]), str(n["unread"]))

# 3) student submits one page (reuse an image upload via multipart is messy in urllib —
#    use ink page + flatten path instead: create ink page, save strokes; flatten is client-side,
#    so upload page via the pages endpoint using multipart built by hand)
import uuid
boundary = uuid.uuid4().hex
png = bytes.fromhex("89504e470d0a1a0a0000000d49484452000000100000001008060000001ff3ff610000001c4944415478da63fcffff3f030d80f1ff3f86ff0c0c0c8c831b0000c1ff0bf3a2969f0000000049454e44ae426082")
body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"pages\"; filename=\"ans.png\"\r\n"
        f"Content-Type: image/png\r\n\r\n").encode() + png + f"\r\n--{boundary}--\r\n".encode()
r = urllib.request.Request(API + f"/api/student/homework/{ASG}/pages?source=ink", data=body, method="POST")
r.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
r.add_header("Authorization", "Bearer " + ST)
urllib.request.urlopen(r)
call("POST", f"/api/student/homework/{ASG}/submit", ST)
sub = call("GET", f"/api/student/homework/{ASG}", ST)["submission"]
check("submit writes history snapshot",
      isinstance(sub.get("history"), list) and sub["history"][-1]["event"] == "submit")
SUB = sub["id"]
pageId = sub["pages"][0]["id"]

# 4) items-based grading: server derives marks from deltas
g = call("PUT", f"/api/homework-submissions/{SUB}/grades", T, {"grades": [
    {"questionId": q1, "awardedMarks": None, "appliedItems": ["m1", "a1"]},   # 2+1=3
    {"questionId": q2, "awardedMarks": None, "appliedItems": ["m2", "u2"]},   # 3-1=2
]})
marks = {x["questionId"]: x["awardedMarks"] for x in g["grades"]}
check("appliedItems -> server-derived marks (3, 2)", marks[q1] == 3 and marks[q2] == 2, str(marks))

# 5) retroactive re-score: change u2 delta -1 -> -2, grade should become 1
rr = call("PATCH", f"/api/homework-questions/{q2}/items/u2", T, {"delta": -2})
g2 = call("GET", f"/api/homework-submissions/{SUB}", T)
m2 = [x for x in g2["grades"] if x["questionId"] == q2][0]["awardedMarks"]
check("retroactive item edit re-scores (2 -> 1)", rr["rescored"] == 1 and m2 == 1, f"rescored={rr['rescored']} marks={m2}")

# 6) annotations save + student sees teacherInk
call("PUT", f"/api/homework-pages/{pageId}/annotations", T,
     {"strokes": [{"pts": [[1, 1, 0.5], [10, 10, 0.5]], "color": "#E0061F", "size": 3}]})
det = call("GET", f"/api/student/homework/{ASG}", ST)
ink = det["submission"]["pages"][0].get("teacherInk")
check("teacher annotations visible to student", isinstance(ink, list) and len(ink) == 1)

# 7) by-question vertical grading data
bq = call("GET", f"/api/homework-assignments/{ASG}/by-question/{q1}", T)
check("by-question returns entries+regions",
      bq["question"]["regions"] and len(bq["entries"]) >= 1 and bq["entries"][0]["grade"] is not None)

# 8) publish -> student notified hw_returned
call("POST", f"/api/homework-submissions/{SUB}/publish", T, {"teacherComment": "v2 回归"})
n2 = call("GET", "/api/notifications", ST)
check("return notification reaches student", any(x["type"] == "hw_returned" for x in n2["items"]))

# 9) regrade flow: student files -> teacher sees -> reply -> student sees + notified
call("POST", f"/api/student/homework/{ASG}/regrade", ST, {"questionId": q2, "message": "书写扣2分太多了"})
lst = call("GET", f"/api/homework-assignments/{ASG}/regrades", T)
check("teacher sees open regrade", any(x["status"] == "open" for x in lst))
rid = [x for x in lst if x["status"] == "open"][0]["id"]
call("POST", f"/api/regrade-requests/{rid}/reply", T, {"reply": "书写规范是评分标准的一部分，维持原判"})
my = call("GET", f"/api/student/homework/{ASG}/regrades", ST)
n3 = call("GET", "/api/notifications", ST)
check("student sees reply + notification",
      my[0]["status"] == "replied" and my[0]["reply"] and any(x["type"] == "regrade_replied" for x in n3["items"]))

# 10) analytics + weakest + csv
an = call("GET", f"/api/homework-assignments/{ASG}/analytics", T)
check("analytics returns bands/perQuestion/weakest",
      len(an["bands"]) == 5 and len(an["perQuestion"]) == 2 and an["returned"] >= 1)
csv = call("GET", f"/api/homework-assignments/{ASG}/export.csv", T, raw=True).decode("utf-8-sig")
check("csv has header+student row", "Student" in csv and "Q1" in csv and len(csv.splitlines()) >= 2)

# 11) mistake book: Q2 (1/4) should appear with topic
mk = call("GET", "/api/student/homework/mistakes", ST)
hit = [m for m in mk if m["label"] == "Q2" and m["topic"] == "求导"]
check("mistake book lists lost-mark Q2 with topic", len(hit) == 1, json.dumps(mk[:1]))

# 12) mark notifications read
call("POST", "/api/notifications/read", ST, {})
n4 = call("GET", "/api/notifications", ST)
check("mark-all-read zeroes unread", n4["unread"] == 0)

print(f"\n==== {len(PASS)} passed, {len(FAIL)} failed ====")
if FAIL: print("FAILED:", FAIL); sys.exit(1)
