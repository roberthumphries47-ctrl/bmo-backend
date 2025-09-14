MacBook-Air:bmo-backend roberthumphries$ git add api/tasks/add.js api/tasks/list.js
MacBook-Air:bmo-backend roberthumphries$ git commit -m "Add tasks add/list endpoints for seeding and debugging"
[main b1c12ae] Add tasks add/list endpoints for seeding and debugging
 2 files changed, 78 insertions(+)
 create mode 100644 api/tasks/add.js
 create mode 100644 api/tasks/list.js
MacBook-Air:bmo-backend roberthumphries$ git push origin main
Enumerating objects: 9, done.
Counting objects: 100% (9/9), done.
Delta compression using up to 8 threads
Compressing objects: 100% (6/6), done.
Writing objects: 100% (6/6), 1.54 KiB | 1.54 MiB/s, done.
Total 6 (delta 2), reused 0 (delta 0), pack-reused 0
remote: Resolving deltas: 100% (2/2), completed with 2 local objects.
To https://github.com/roberthumphries47-ctrl/bmo-backend.git
   55532f4..b1c12ae  main -> main
MacBook-Air:bmo-backend roberthumphries$ curl -s -X POST https://bmo-backend.vercel.app/api/tasks/add \
>   -H "Content-Type: application/json" \
>   -d '{"title":"Test Gig","bucket":"Solo Ops"}' | jq
jq: parse error: Invalid numeric literal at line 1, column 4
MacBook-Air:bmo-backend roberthumphries$ curl -s "https://bmo-backend.vercel.app/api/tasks/add?title=Test%20Gig&bucket=Solo%20Ops" | jq
{
  "ok": false,
  "error": "add_failed",
  "details": "Invalid URL"
}
MacBook-Air:bmo-backend roberthumphries$ curl -s -X POST https://bmo-backend.vercel.app/api/tasks/add \
>   -H "Content-Type: application/json" \
>   -d '{"title":"Test Gig","bucket":"Solo Ops"}' | jq
{
  "ok": false,
  "error": "add_failed",
  "details": "Invalid URL"
}
MacBook-Air:bmo-backend roberthumphries$ curl -s https://bmo-backend.vercel.app/api/tasks/list | jq
{
  "ok": false,
  "error": "list_failed",
  "details": "Invalid URL"
}
MacBook-Air:bmo-backend roberthumphries$ curl -s https://bmo-backend.vercel.app/api/download/evening | jq '{ok, message}'
{
  "ok": null,
  "message": null
}
MacBook-Air:bmo-backend roberthumphries$ curl -s https://bmo-backend.vercel.app/api/download/evening | jq '{ok, message}'
{
  "ok": null,
  "message": null
}
MacBook-Air:bmo-backend roberthumphries$ 
