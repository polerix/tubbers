from PIL import Image

def find_inner():
    img = Image.open('gameCase.png')
    w, h = img.size
    pixels = img.load()

    cx, cy = w // 2, h // 2

    # Check that center is transparent
    if pixels[cx, cy][3] > 100:
        print("Center is not transparent!")
        return

    # Find top
    y_top = cy
    while y_top > 0 and pixels[cx, y_top][3] < 100:
        y_top -= 1

    # Find bottom
    y_bottom = cy
    while y_bottom < h - 1 and pixels[cx, y_bottom][3] < 100:
        y_bottom += 1

    # Find left
    x_left = cx
    while x_left > 0 and pixels[x_left, cy][3] < 100:
        x_left -= 1

    # Find right
    x_right = cx
    while x_right < w - 1 and pixels[x_right, cy][3] < 100:
        x_right += 1

    print(f"Inner Hole Bounds: x: {x_left} to {x_right}, y: {y_top} to {y_bottom}")
    print(f"Left: {x_left/w*100:.2f}%")
    print(f"Top: {y_top/h*100:.2f}%")
    print(f"Width: {(x_right - x_left)/w*100:.2f}%")
    print(f"Height: {(y_bottom - y_top)/h*100:.2f}%")

if __name__ == '__main__':
    find_inner()
