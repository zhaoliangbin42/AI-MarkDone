当然！这里提供几个不同用途的 `sin` 函数 Python 代码示例：

            ## 1. **基础计算：使用 math 库**

            
                
                ```python
import math

# 计算角度的正弦值（输入为弧度）
angle_rad = math.pi / 6  # 30度对应的弧度
sin_value = math.sin(angle_rad)

print(f"sin(π/6) = {sin_value:.4f}")  # 输出: sin(π/6) = 0.5000
```

                
                    
                
                    
                
            
            ## 2. **角度转弧度后计算**

            
                
                ```python
import math

# 输入角度计算正弦值
def sin_from_degrees(degrees):
    radians = math.radians(degrees)  # 角度转弧度
    return math.sin(radians)

# 计算30度、45度、90度的正弦值
for deg in [30, 45, 90]:
    value = sin_from_degrees(deg)
    print(f"sin({deg}°) = {value:.4f}")
```

                
                    
                
                    
                
            
            ## 3. **绘制正弦函数波形图**

            
                
                ```python
import numpy as np
import matplotlib.pyplot as plt

# 生成正弦波数据
x = np.linspace(0, 4*np.pi, 1000)  # 0到4π之间1000个点
y = np.sin(x)

# 绘制图形
plt.figure(figsize=(10, 4))
plt.plot(x, y, 'b-', linewidth=2, label='sin(x)')
plt.title('正弦函数波形', fontsize=14)
plt.xlabel('x (弧度)', fontsize=12)
plt.ylabel('sin(x)', fontsize=12)
plt.grid(True, alpha=0.3)
plt.legend()
plt.axhline(y=0, color='k', linewidth=0.5)  # x轴
plt.axvline(x=0, color='k', linewidth=0.5)  # y轴
plt.show()
```

                
                    
                
                    
                
            
            ## 4. **自定义sin函数实现（泰勒展开）**

            
                
                ```python
def my_sin(x, terms=10):
    """
    使用泰勒级数近似计算sin(x)
    sin(x) ≈ x - x³/3! + x⁵/5! - x⁷/7! + ...
    """
    result = 0
    for n in range(terms):
        coefficient = (-1)**n
        exponent = 2*n + 1
        term = coefficient * (x**exponent) / math.factorial(exponent)
        result += term
    return result

# 与math库对比
x_val = 1.0  # 弧度
custom = my_sin(x_val, terms=10)
builtin = math.sin(x_val)

print(f"自定义sin(1): {custom:.10f}")
print(f"math.sin(1):  {builtin:.10f}")
print(f"误差: {abs(custom - builtin):.2e}")
```

                
                    
                
                    
                
            
            ## 5. **实时正弦波生成（音频示例）**

            
                
                ```python
import numpy as np
import sounddevice as sd  # 需要安装：pip install sounddevice

# 生成音频正弦波
def generate_sine_wave(freq=440, duration=2, sample_rate=44100):
    """生成指定频率的正弦波音频"""
    t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
    wave = 0.5 * np.sin(2 * np.pi * freq * t)
    return wave

# 生成A4音高（440Hz）的正弦波，播放2秒
audio = generate_sine_wave(freq=440, duration=2)
sd.play(audio, samplerate=44100)
sd.wait()  # 等待播放完成
```

                
                    
                
                    
                
            
            ## 6. **三维正弦曲面**

            
                
                ```python
import numpy as np
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D

# 创建三维正弦曲面
x = np.linspace(-2*np.pi, 2*np.pi, 100)
y = np.linspace(-2*np.pi, 2*np.pi, 100)
X, Y = np.meshgrid(x, y)
Z = np.sin(np.sqrt(X**2 + Y**2))  # 径向正弦波

# 绘制
fig = plt.figure(figsize=(10, 7))
ax = fig.add_subplot(111, projection='3d')
surf = ax.plot_surface(X, Y, Z, cmap='viridis', alpha=0.8)
fig.colorbar(surf)
ax.set_title('三维正弦曲面', fontsize=14)
plt.show()
```

                
                    
                
                    
                
            
            ## **运行建议**

            - 基础计算使用 **示例1或2**
- 可视化使用 **示例3**
- 学习算法原理使用 **示例4**
- 音频处理使用 **示例5**（需要安装
                        `sounddevice`）
- 高级可视化使用 **示例6**

            最常用的是
                **示例1和3**，分别对应数值计算和可视化需求。