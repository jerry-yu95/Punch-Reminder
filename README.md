# Punch Reminder

一个跨平台的每日打卡提醒工具，支持签到/签退、预提醒、托盘常驻与毛玻璃浮窗。

## 功能
- 支持 Windows / macOS 安装包
- 每日签到、签退提醒
- 上班/下班前预提醒
- 系统通知 + 毛玻璃浮窗
- 托盘/菜单栏常驻

## 开发与运行
```bash
npm install
npm run dev
```

## 打包
```bash
npm run dist
```

## 自动构建与发布
- 推送到 `main`/`master` 会触发构建并上传产物
- 打 tag `v*` 会自动发布 Release 并上传安装包

## 备注
- macOS 需允许通知权限
- 未签名应用初次打开可能被系统拦截
