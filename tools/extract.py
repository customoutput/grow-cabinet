import sys, json, numpy as np, cv2
sys.path.insert(0, '/home/claude/shelf/tools')
from leafdefs import A, C, H, I
SRC = '/home/claude/shelf/src/'
OUT = sys.argv[1]
S = 1024; JY, TY = 650, 40; LPX = JY - TY

def chaikin(pts, n=3):
    p = np.array(pts, float)
    for _ in range(n):
        q = 0.75 * p + 0.25 * np.roll(p, -1, 0); r = 0.25 * p + 0.75 * np.roll(p, -1, 0)
        p = np.empty((len(q) * 2, 2)); p[0::2] = q; p[1::2] = r
    return p

def poly_mask(shape, pts, scale=4):
    h, w = shape
    m = np.zeros((h * scale, w * scale), np.uint8)
    p = (chaikin(pts) * scale).astype(np.int32)
    cv2.fillPoly(m, [p], 255, lineType=cv2.LINE_AA)
    return cv2.resize(m, (w, h), interpolation=cv2.INTER_AREA)

def similarity(J, T):
    J = np.array(J, float); T = np.array(T, float)
    v = T - J; L = np.linalg.norm(v); s = LPX / L
    ang = np.arctan2(v[1], v[0]); target = np.arctan2(-1, 0)  # tip straight up
    a = target - ang; c, si = np.cos(a) * s, np.sin(a) * s
    M = np.array([[c, -si, 0], [si, c, 0]])
    M[:, 2] = np.array([S / 2, JY]) - M[:, :2] @ J
    return M

def mirror_pts(pts, J, T):
    J = np.array(J, float); d = np.array(T, float) - J; d /= np.linalg.norm(d)
    out = []
    for p in pts:
        v = np.array(p, float) - J; along = v @ d * d
        out.append(tuple(J + along - (v - along)))
    return out

def flatten_light(img, mask, amount):
    lab = cv2.cvtColor(img, cv2.COLOR_RGB2LAB).astype(np.float32)
    m = (mask > 128).astype(np.float32)
    L = lab[..., 0]
    sig = 70
    num = cv2.GaussianBlur(L * m, (0, 0), sig); den = cv2.GaussianBlur(m, (0, 0), sig) + 1e-4
    low = num / den
    mean = (L * m).sum() / m.sum()
    lab[..., 0] = np.clip(L - amount * (low - mean), 0, 255)
    return cv2.cvtColor(lab.astype(np.uint8), cv2.COLOR_LAB2RGB)

def bleed(img, mask):
    inner = cv2.erode((mask > 200).astype(np.uint8), np.ones((5, 5), np.uint8))
    out = img.copy(); known = inner.astype(bool)
    acc = img.astype(np.float32) * known[..., None]; cnt = known.astype(np.float32)
    for r in range(40):
        a = cv2.blur(acc, (5, 5)); c = cv2.blur(cnt, (5, 5))
        newk = (c > 0.05) & ~known
        out[newk] = (a[newk] / c[newk, None]).astype(np.uint8)
        acc = out.astype(np.float32) * (known | newk)[..., None]; known = known | newk; cnt = known.astype(np.float32)
    return out

def normal_map(img, mask, strength):
    g = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255
    hp = g - cv2.GaussianBlur(g, (0, 0), 6)
    h = cv2.GaussianBlur(hp, (0, 0), 1.0)
    dx = cv2.Sobel(h, cv2.CV_32F, 1, 0, ksize=3) * strength
    dy = cv2.Sobel(h, cv2.CV_32F, 0, 1, ksize=3) * strength
    n = np.dstack([-dx, dy, np.ones_like(dx)]); n /= np.linalg.norm(n, axis=2, keepdims=True)
    return ((n * 0.5 + 0.5) * 255).astype(np.uint8)

def build(name, d, img, mask_full, normal_strength, flat):
    M = similarity(d['J'], d['T'])
    col = cv2.warpAffine(img, M, (S, S), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
    msk = cv2.warpAffine(mask_full, M, (S, S), flags=cv2.INTER_LINEAR)
    msk = cv2.GaussianBlur(cv2.erode(msk, np.ones((3, 3), np.uint8), iterations=2), (0, 0), 0.8)
    col = flatten_light(col, msk, flat)
    col = bleed(col, msk)
    nrm = normal_map(col, msk, normal_strength)
    cv2.imwrite(f'{OUT}/{name}_c.jpg', cv2.cvtColor(col, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 88])
    cv2.imwrite(f'{OUT}/{name}_a.png', msk)
    cv2.imwrite(f'{OUT}/{name}_n.jpg', cv2.cvtColor(nrm, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 90])
    ys, xs = np.where(msk > 128)
    meta = dict(name=name, variety=d['variety'], jv=1 - JY / S, tv=1 - TY / S,
                xmin=xs.min() / S, xmax=xs.max() / S, ymin=1 - ys.max() / S, ymax=1 - ys.min() / S)
    return meta

imgs = {k: cv2.cvtColor(cv2.imread(SRC + k + '.jpg'), cv2.COLOR_BGR2RGB) for k in ['bvp_main', 'bvp_group', 'ds']}
metas = []
for name, d, ns, fl in [('bvp_a', A, 5, 0.55), ('bvp_c', C, 5, 0.45), ('ds_h', H, 7, 0.5)]:
    img = imgs[d['src']]
    metas.append(build(name, d, img, poly_mask(img.shape[:2], d['poly']), ns, fl))

# High-variegation Dragon Scale: same leaf, with the mint areas bleached toward cream (as on very variegated leaves)
def creamify(col, msk):
    lab = cv2.cvtColor(col, cv2.COLOR_RGB2LAB).astype(np.float32)
    L, a, b = lab[..., 0], lab[..., 1] - 128, lab[..., 2] - 128
    light = np.clip((L - 120) / 70, 0, 1)
    light = cv2.GaussianBlur(light, (0, 0), 1.2)
    L2 = L + light * (232 - L) * 0.75
    a2 = a * (1 - 0.7 * light); b2 = b * (1 - 0.55 * light) + light * 6
    out = np.dstack([np.clip(L2, 0, 255), np.clip(a2 + 128, 0, 255), np.clip(b2 + 128, 0, 255)]).astype(np.uint8)
    return cv2.cvtColor(out, cv2.COLOR_LAB2RGB)
import shutil
c = cv2.cvtColor(cv2.imread(f'{OUT}/ds_h_c.jpg'), cv2.COLOR_BGR2RGB)
m = cv2.imread(f'{OUT}/ds_h_a.png', 0)
cv2.imwrite(f'{OUT}/ds_hc_c.jpg', cv2.cvtColor(creamify(c, m), cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 88])
meta = dict(metas[-1]); meta['name'] = 'ds_hc'; meta['alphaOf'] = 'ds_h'; meta['normalOf'] = 'ds_h'
metas.append(meta)
json.dump(metas, open(f'{OUT}/leaves.json', 'w'), indent=1)
print(json.dumps(metas, indent=1))
