import sys, json, urllib.request

token = open('/tmp/admin_token').read().strip()
pid = sys.argv[1]
req = urllib.request.Request(
    f'https://exam-paper-system-production.up.railway.app/api/papers/{pid}',
    headers={'Authorization': f'Bearer {token}'},
)
d = json.loads(urllib.request.urlopen(req).read())
qs = d.get('questions', [])
print('paper:', d.get('name'))
print('config:', d.get('config'))
print('question count:', len(qs))
print()
for i, q in enumerate(qs):
    qq = q.get('question', q)
    qtype = qq.get('questionType')
    content = qq.get('content') or {}
    options = qq.get('options') or []
    answer = qq.get('answerContent') or {}
    sourceRef = qq.get('sourceRef')
    stem = (content.get('stem') or content.get('text') or '')[:200]
    print(f'Q{i+1} type={qtype} marks={qq.get("marks")} optCount={len(options)} ref={sourceRef}')
    print('  stem:', repr(stem))
    if 'passage' in content:
        ptxt = content['passage'][:160]
        print('  passage_inline:', repr(ptxt))
    if 'paragraph' in content:
        print('  paragraph:', repr(str(content['paragraph'])[:120]))
    for k in content:
        if k not in ('stem','text','passage','paragraph'):
            print(f'  content.{k}:', repr(str(content[k])[:120]))
    if options:
        print('  options:')
        for opt in options[:5]:
            print('   -', str(opt)[:140])
    if answer:
        print('  answer:', str(answer)[:120])
    print()
