"""영어 단어장 만들기 — python3 sim/seed-english.py [--force]

   **문제가 아니라 단어만 적습니다.** `단어,뜻` 한 줄이 문제 세 개가 됩니다(packs.py).
   부모가 나중에 손으로 단어를 추가할 때도 같은 형식이면 됩니다 —
   기획서 14장의 '사진으로 단어 등록'도 결국 이 형식으로 떨어집니다.

   같은 파일에 **같은 단어나 같은 뜻이 둘 있으면 안 됩니다.** 보기가 겹칩니다.
   이 스크립트가 끝에서 검사합니다."""

import csv
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / 'content' / 'problems' / '영어'
HEAD = ['단어', '뜻', '힌트']

PACKS = {
'1-1 인사와 나': [
 ('hello', '안녕', '만났을 때 하는 인사야'),
 ('hi', '안녕 (짧게)', '아주 짧은 인사야'),
 ('good', '좋은', ''),
 ('morning', '아침', ''),
 ('name', '이름', ''),
 ('friend', '친구', ''),
 ('teacher', '선생님', ''),
 ('nice', '멋진', ''),
 ('meet', '만나다', ''),
 ('bye', '잘 가', '헤어질 때 하는 말이야'),
 ('sorry', '미안해', ''),
 ('thank', '고마워하다', ''),
],
'1-2 숫자': [
 ('one', '하나', ''), ('two', '둘', ''), ('three', '셋', ''), ('four', '넷', ''),
 ('five', '다섯', ''), ('six', '여섯', ''), ('seven', '일곱', ''), ('eight', '여덟', ''),
 ('nine', '아홉', ''), ('ten', '열', ''), ('eleven', '열하나', ''), ('twelve', '열둘', ''),
],
'1-3 색깔과 모양': [
 ('red', '빨강', ''), ('blue', '파랑', ''), ('yellow', '노랑', ''), ('green', '초록', ''),
 ('black', '검정', ''), ('white', '하양', ''), ('pink', '분홍', ''), ('brown', '갈색', ''),
 ('circle', '동그라미', ''), ('square', '네모', ''), ('triangle', '세모', ''), ('color', '색깔', ''),
],
'1-4 학용품': [
 ('book', '책', ''), ('pencil', '연필', ''), ('eraser', '지우개', ''), ('ruler', '자', ''),
 ('bag', '가방', ''), ('desk', '책상', ''), ('chair', '의자', ''), ('crayon', '크레용', ''),
 ('notebook', '공책', ''), ('glue', '물풀', '종이를 붙이는 거야'), ('scissors', '가위', ''), ('pen', '펜', ''),
],
'2-1 음식': [
 ('apple', '사과', ''), ('banana', '바나나', ''), ('milk', '우유', ''), ('bread', '빵', ''),
 ('water', '물', ''), ('rice', '밥', ''), ('egg', '달걀', ''), ('cake', '케이크', ''),
 ('juice', '주스', ''), ('orange', '오렌지', ''), ('pizza', '피자', ''), ('candy', '사탕', ''),
],
'2-2 동물': [
 ('cat', '고양이', ''), ('dog', '개', ''), ('bird', '새', ''), ('fish', '물고기', ''),
 ('rabbit', '토끼', ''), ('tiger', '호랑이', ''), ('lion', '사자', ''), ('bear', '곰', ''),
 ('monkey', '원숭이', ''), ('elephant', '코끼리', ''), ('horse', '말', ''), ('duck', '오리', ''),
],
'2-3 가족과 몸': [
 ('father', '아빠', ''), ('mother', '엄마', ''), ('sister', '여자 형제', '누나 · 언니 · 여동생'),
 ('brother', '남자 형제', '형 · 오빠 · 남동생'), ('baby', '아기', ''), ('hand', '손', ''),
 ('foot', '발', ''), ('head', '머리', ''), ('eye', '눈', ''), ('nose', '코', ''),
 ('mouth', '입', ''), ('ear', '귀', ''),
],
'2-4 날씨와 하루': [
 ('sunny', '맑은', ''), ('rainy', '비 오는', ''), ('cloudy', '흐린', ''), ('windy', '바람 부는', ''),
 ('snowy', '눈 오는', ''), ('hot', '더운', ''), ('cold', '추운', ''), ('today', '오늘', ''),
 ('night', '밤', ''), ('school', '학교', ''), ('home', '집', ''), ('play', '놀다', ''),
],
}

if __name__ == '__main__':
    force = '--force' in sys.argv
    OUT.mkdir(parents=True, exist_ok=True)

    bad = 0
    for name, words in PACKS.items():
        ws = [w for w, _, _ in words]
        ms = [m for _, m, _ in words]
        for label, col in (('단어', ws), ('뜻', ms)):
            dup = {x for x in col if col.count(x) > 1}
            if dup:
                bad += 1
                print(f'  !! {name} — 같은 {label}이(가) 두 번: {", ".join(dup)}')
    if bad:
        sys.exit('겹치는 것을 고친 뒤에 다시 돌리세요. 보기가 겹칩니다.')

    for name, words in PACKS.items():
        path = OUT / f'{name}.csv'
        if path.exists() and not force:
            print(f'  건너뜀 (이미 있음): {path.name}')
            continue
        with path.open('w', encoding='utf-8', newline='') as f:
            w = csv.writer(f)
            w.writerow(HEAD)
            w.writerows(words)
        print(f'  {path.name:22} 단어 {len(words):3}개')
