function $(id){return document.getElementById(id)}
function toast(m,e){
var t=$("toast");t.textContent=m;t.className="toast"+(e?" e":"");t.style.display="block"
setTimeout(function(){t.style.display="none"},2500)
}

async function load(){
var r=await chrome.runtime.sendMessage({type:"TASK_LIST"})
if(!r||!r.success||!r.data){$("list").innerHTML='<p style="color:#999">暂无</p>';return}
var h="";r.data.sort(function(a,b){return a.createdAt-b.createdAt})
for(var i=0;i<r.data.length;i++){var t=r.data[i]
var s=t.enabled!==false?"g":"gy"
var v=t.lastValue!==undefined?t.lastValue:"-"
h+='<div class="t"><span class="st '+s+'"></span><span class="n">'+esc(t.name)+'</span> <span class="m">'+t.interval+'s</span>'
h+='<div class="v">'+esc(v)+'</div><div class="m">'+esc(t.url)+'</div>'
h+='<div class="act"><button data-id="'+t.id+'" class="tg">'+(t.enabled!==false?"暂停":"启用")+'</button>'
h+='<button data-id="'+t.id+'" class="rm">删</button></div></div>'
}
$("list").innerHTML=h
Array.from(document.querySelectorAll(".tg")).forEach(function(b){
b.onclick=async function(){await chrome.runtime.sendMessage({type:"TASK_TOGGLE",taskId:b.dataset.id});load()}
})
Array.from(document.querySelectorAll(".rm")).forEach(function(b){
b.onclick=async function(){if(!confirm("删除?"))return;await chrome.runtime.sendMessage({type:"TASK_DELETE",taskId:b.dataset.id});load()}
})
}
function esc(s){if(!s)return "";return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}

$("addBtn").onclick=async function(){
var task={name:$("n").value.trim()||"未命名",url:$("u").value.trim(),interval:parseInt($("iv").value)||60,
cropX:parseInt($("x").value)||0,cropY:parseInt($("y").value)||0,cropW:parseInt($("w").value)||200,cropH:parseInt($("h").value)||50,
alertOnChange:$("chg").checked,alertOnTarget:$("tgt").checked,operator:$("op").value,targetValue:$("tv").value.trim(),
notifyQQ:$("qq").checked,notifySound:$("sd").checked,soundType:$("sf").value}
if(!task.url){toast("输入URL",true);return}
if(!task.url.startsWith("http"))task.url="https://"+task.url
var r=await chrome.runtime.sendMessage({type:"TASK_CREATE",task})
if(r.success){toast("已添加");$("u").value="";$("n").value="";load()}
else{toast(r.error?.message||"失败",true)}
}

$("tsSound").onclick=function(){chrome.runtime.sendMessage({type:"PLAY_SOUND",sound:$("sf").value});$("tsR").textContent="已播放";setTimeout(function(){$("tsR").textContent=""},2000)}
$("tsQQ").onclick=function(){chrome.runtime.sendMessage({type:"TEST_NOTIFY",text:"WebMonitor Pro测试"});$("tsR").textContent="已发送";setTimeout(function(){$("tsR").textContent=""},2000)}

load()