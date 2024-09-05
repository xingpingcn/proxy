// 反代目标网站.
const upstream = 'github.com';

// 反代目标网站的移动版.
const upstream_mobile = 'github.com';

// 访问区域黑名单（按需设置）.
const blocked_region = ['cn','china','taiwan','hk'];

// IP地址黑名单（按需设置）.
const blocked_ip_address = ['0.0.0.0', '127.0.0.1'];

// 路径替换.
const replace_dict = {
  '$upstream': '$custom_domain', // 将"$upstream"替换为"$custom_domain"
  '//github.com': '' // 移除路径中的"//github.com"
};

addEventListener('fetch', event => {
  event.respondWith(fetchAndApply(event.request));
});

async function fetchAndApply(request) {
  const region = request.headers.get('cf-ipcountry').toUpperCase(); // 获取访问者所在的地区
  const ip_address = request.headers.get('cf-connecting-ip'); // 获取访问者的IP地址
  const user_agent = request.headers.get('user-agent'); // 获取访问者的User-Agent头部信息

  let response = null;
  let url = new URL(request.url);
  let url_host = url.host;

  if (url.protocol == 'http:') { // 如果请求协议是HTTP，则重定向到HTTPS
    url.protocol = 'https:';
    response = Response.redirect(url.href);
    return response;
  }

  if (await device_status(user_agent)) { // 判断是否为移动设备
    var upstream_domain = upstream;
  } else {
    var upstream_domain = upstream_mobile;
  }

  url.host = upstream_domain;

  if (blocked_region.includes(region)) { // 检查访问区域是否在黑名单中
    response = new Response('Access denied: WorkersProxy is not available in your region yet.', {
      status: 403
    });
  } else if (blocked_ip_address.includes(ip_address)){ // 检查IP地址是否在黑名单中
    response = new Response('Access denied: Your IP address is blocked by WorkersProxy.', {
      status: 403
    });
  } else {
    let method = request.method;
    let request_headers = request.headers;
    let new_request_headers = new Headers(request_headers);

    new_request_headers.set('Host', upstream_domain); // 设置请求头的Host字段为反代目标网站的域名
    new_request_headers.set('Referer', url.href); // 设置请求头的Referer字段为当前请求的URL

    let original_response = await fetch(url.href, {
      method: method,
      headers: new_request_headers
    });

    let original_response_clone = original_response.clone();
    let original_text = null;
    let response_headers = original_response.headers;
    let new_response_headers = new Headers(response_headers);
    let status = original_response.status;

    // 修改响应头的设置
    new_response_headers.set('cache-control', 'public, max-age=14400');
    new_response_headers.set('access-control-allow-origin', '*');
    new_response_headers.set('access-control-allow-credentials', true);
    new_response_headers.delete('content-security-policy');
    new_response_headers.delete('content-security-policy-report-only');
    new_response_headers.delete('clear-site-data');

    const content_type = new_response_headers.get('content-type');
    if (content_type && content_type.includes('text/html') && content_type.includes('UTF-8')) {
      original_text = await replace_response_text(original_response_clone, upstream_domain, url_host); // 替换响应中的文本内容
    } else {
      original_text = original_response_clone.body;
    }

    response = new Response(original_text, {
      status,
      headers: new_response_headers
    });
  }
  return response;
}

async function replace_response_text(response, upstream_domain, host_name) {
  let text = await response.text();

  for (let i in replace_dict) {
    let j = replace_dict[i];
    if (i == '$upstream') {
      i = upstream_domain;
    } else if (i == '$custom_domain') {
      i = host_name;
    }

    if (j == '$upstream') {
      j = upstream_domain;
    } else if (j == '$custom_domain') {
      j = host_name;
    }

    let re = new RegExp(i, 'g');
    text = text.replace(re, j); // 使用正则表达式替换文本内容
  }

  return text;
}

async function device_status(user_agent_info) {
  var agents = ["Android", "iPhone", "SymbianOS", "Windows Phone", "iPad", "iPod"];
  var flag = true;
  for (var v = 0; v < agents.length; v++) {
    if (user_agent_info.indexOf(agents[v]) > 0) {
      flag = false;
      break;
    }
  }
  return flag;
}
