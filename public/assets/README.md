# 本地素材目录

出于版权考虑，此目录下除本说明外的所有文件都被 `.gitignore` 排除，**不会进入公开仓库**。素材放在本地即可被页面加载；部署环境没有素材时页面自动降级为纯代码视觉。

## 放置约定

```
assets/
  audio/
    echoes-of-longing.mp3   ← 音源（也接受 .ogg / .m4a，或 song.mp3）
  img/
    （任意图片：官方立绘、CG 截图、专辑封面、你的手写素材……）
```

- **音频**：页面启动时按上述文件名探测；找不到时入场页会提供本地文件选择。
- **图片**：文件名不限，由各 cut 通过 `fx/imagePlane.js` 按路径引用（例如 `assets/img/malkuth.png`），获得视差 / 噪声溶解 / RGB 分离等处理。素材缺失时 `loadImagePlane` 返回 `null`，cut 据此降级。
