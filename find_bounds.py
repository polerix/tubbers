from PIL import Image

def find_bounds():
    img = Image.open('gameCase.png')
    w, h = img.size
    pixels = img.load()

    min_x, max_x = w, 0
    min_y, max_y = h, 0

    for y in range(h):
        for x in range(w):
            rgba = pixels[x, y]
            if len(rgba) == 4 and rgba[3] < 10:  # nearly fully transparent
                min_x = min(min_x, x)
                max_x = max(max_x, x)
                min_y = min(min_y, y)
                max_y = max(max_y, y)

    if min_x > max_x:
        print("No transparent pixels found!")
        return

    print(f"Bounds: x: {min_x} to {max_x}, y: {min_y} to {max_y}")
    print(f"Left: {min_x/w*100:.2f}%")
    print(f"Top: {min_y/h*100:.2f}%")
    print(f"Width: {(max_x - min_x)/w*100:.2f}%")
    print(f"Height: {(max_y - min_y)/h*100:.2f}%")

if __name__ == '__main__':
    find_bounds()
