# 아웃컴 메저 (치료사용 + 환자 설문)

- `index.html` : 치료사 앱 (환자 등록, 설문 보내기, 결과 가져오기, 전후 비교, 해석 기준)
- `survey.html` : 환자가 링크로 여는 설문 화면
- `catalog.json` : 관절별 설문지 목록 (status: ready=사용 가능, answers=답변만, pending=준비 중)
- `q/*.json` : 설문지 하나당 파일 하나 (문항, 보기 점수, 채점법, 출처 쪽수). 46종 수록
  - `scoring`이 없는 설문지는 답변만 저장 (원문에 채점법 없음)
  - `notes`에 원문과 다르게 보이는 부분을 '의견'으로 적어 두었음
- `survey-engine.js` : 설문 작성 화면 (환자 링크·현장 작성 공용)
- `common.js`, `style.css`, `manifest.json`, `sw.js`, `icon-*.png`

## 올리기
GitHub 새 저장소(예: outcome) → 압축 푼 폴더 안의 파일과 `q` 폴더를 모두 업로드 → Settings → Pages → main / (root) → Save
치료사 앱 주소: https://아이디.github.io/저장소이름/

## 설문지 추가
`q/새설문.json`을 추가하고 `catalog.json`의 해당 관절에 `{"id":"새설문","name":"이름","status":"ready"}`를 넣으면 됩니다.
