const fs = require('fs');
const path = require('path');

/**
 * 将 Alpaca 格式 (instruction, input, output) 
 * 转换为 OpenAI/阿里云百炼兼容的 JSONL 格式 (messages)
 */
function convertAlpacaToJSONL() {
  const inputPath = path.join(__dirname, 'test.json');
  const outputPath = path.join(__dirname, 'train.jsonl');

  try {
    // 1. 读取原始 JSON 数据
    const rawData = fs.readFileSync(inputPath, 'utf8');
    const alpacaData = JSON.parse(rawData);

    console.log(`📂 正在处理 ${alpacaData.length} 条数据...`);

    // 2. 转换为 OpenAI 消息格式
    const jsonlLines = alpacaData.map(item => {
      // 组合 instruction 和 input。如果 input 为空，则只使用 instruction
      const systemContent = item.instruction;
      const userContent = item.input;
      const assistantContent = item.output;

      return JSON.stringify({
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: userContent },
          { role: "assistant", content: assistantContent }
        ]
      });
    });

    // 3. 写入 JSONL 文件（每行一个 JSON 对象）
    fs.writeFileSync(outputPath, jsonlLines.join('\n'), 'utf8');

    console.log(`✅ 转换成功！新文件已保存至: ${outputPath}`);
    console.log(`💡 你现在可以将 train.jsonl 上传到阿里云百炼或 OpenAI 进行微调了。`);

  } catch (error) {
    console.error('❌ 转换失败:', error.message);
  }
}

// 执行转换
convertAlpacaToJSONL();
