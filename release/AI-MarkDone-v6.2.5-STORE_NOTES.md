# AI-MarkDone 6.2.5 商店与发布文案

状态：本地准备稿，尚未提交 Chrome Web Store、Firefox Add-ons 或 GitHub Release。
维护者已授权 main 合并、推送、标签和本地打包；GitHub Release 上传与商店提交另行进行。Firefox ZIP 是未签名的 WebExtension 安装包，不称为已签名 XPI。

## 中文更新说明

朋友们好！这次带来 6.2.5，主要改进页面宽度、高亮、书签跳转和快捷键，也继续整理常用小窗口，让日常操作更直接。感谢大家反馈具体的使用问题，帮助我找到并修复这些细节。

1. 进一步优化注释框的使用体验，简化编辑界面，将完整原文、窗口工具和删除等操作收进按需展开的区域。注释仍需点击“保存”才会提交（感谢邮箱@qds19100）。
2. 修复修改页面宽度失效的问题，让对话正文和输入框的宽度能够同步调整（感谢小红书用户@Serein）。
3. 修复已有高亮无法直接换色的问题，并增强表格、多段文字和完整公式等混合内容的跨块高亮能力（感谢邮箱@qds19100）。
4. 升级了书签的跳转能力，跨对话打开书签时会优先定位到对应消息，改善跳转的稳定性。
5. 增加按键自定义能力，可以修改常用快捷键，并提供冲突提示、停用和恢复默认等操作（感谢小红书用户@短片）
6. 将页面宽度的调节范围扩展为50%～500%，改用输入框和加减按钮，以25%为步进调整，100%恢复官方宽度（感谢GitHub用户@neuromaancer）。
7. 缩小了右下角图标的大小，减少对输入框的遮挡（感谢小红书用户@Jar Sin）。
8. 进一步简化提示词、保存书签、发送和阅读器设置等小窗口，让常用操作更直接，较少使用的选项按需展开。
9. 优化消息导出窗口，将消息选择与导出选项分组显示，让操作更清晰。
10. 修复新回复已出现但目录没有收录、书签仍不可用的问题，让阅读器和当前消息导出跟随同一份最新内容更新。
11. 重新整理注释复制流程，默认不再全选，可以勾选注释并按需搭配提示词；复制后保留勾选，支持在同一窗口确认批量删除，插入注释后不再自动删除。

## English release notes

Hello, friends! Version 6.2.5 improves page width, highlights, bookmark navigation and keyboard shortcuts. I have also simplified the smaller windows used every day. Thank you for sharing specific problems and helping me improve these details.

1. Simplify the annotation editor, with full source, window tools and deletion available on demand. Choose Save to submit the annotation. Thanks to email user @qds19100.
2. Fix page-width adjustments so conversation content and the input box change together. Thanks to Xiaohongshu user @Serein.
3. Fix recoloring existing highlights and improve selections across table cells, paragraphs and complete formulas. Thanks to email user @qds19100.
4. Improve cross-conversation bookmark navigation by opening the saved message directly.
5. Customize common keyboard shortcuts, with conflict feedback, disable controls and restore-to-default actions. Thanks to Xiaohongshu user @短片.
6. Adjust page width from 50% to 500% with a numeric field and minus/plus buttons in 25% steps; 100% restores the official layout. Thanks to GitHub user @neuromaancer.
7. Reduce the lower-right icons to leave more room for the input box. Thanks to Xiaohongshu user @Jar Sin.
8. Simplify Prompt, bookmark-saving, Send and Reader settings windows, keeping common actions visible and revealing less-used options on demand.
9. Improve the message export window with clearer groups for message selection and export options.
10. Fix completed replies missing from the directory or remaining unavailable to bookmarks, and keep Reader and current-message exports aligned with the latest content.
11. Choose annotations before copying, with no initial selection and an optional Prompt. Copying keeps the selection; confirmed batch deletion is available in the same window. Inserting annotations no longer deletes them automatically.

## 商店更新简述 / Short update summary

6.2.5：页面宽度支持 50%～500% 与 25% 步进；新增自定义快捷键，改进高亮换色、跨块选择和书签跳转，修复新回复的目录与书签收录，并简化常用窗口和消息导出。

6.2.5: Adjust page width from 50% to 500% in 25% steps, customize keyboard shortcuts, improve highlight recoloring, mixed selections and bookmark navigation, keep new replies available to the directory and bookmarks, and simplify everyday windows and exports.
