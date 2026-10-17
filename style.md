# Manchester United Performance Analytics

## Design System & UI Style Guide v1.0

> **Project Type:** Football Performance Analytics Dashboard
> **Primary Language:** Thai
> **Secondary Language:** English
> **Default Theme:** Dark
> **Alternative Theme:** Light
> **Design Direction:** Clean / Modern + Premium Dark
> **Primary Subject:** Manchester United on-pitch performance, statistics, matches, players and tactical data

---

# 1. Design Philosophy

เว็บไซต์นี้เป็น **Football Performance Analytics Dashboard** ไม่ใช่เว็บไซต์ข่าวฟุตบอลทั่วไป และไม่ใช่ Fan Site

เป้าหมายหลักคือทำให้ผู้ใช้สามารถ:

1. ดูผลงานของทีมได้อย่างรวดเร็ว
2. วิเคราะห์แนวโน้มของทีม
3. วิเคราะห์ผลงานรายนัด
4. วิเคราะห์ผู้เล่น
5. เปรียบเทียบสถิติ
6. ดู Tactical / Performance Data
7. เข้าใจข้อมูลได้โดยไม่ต้องเป็น Data Analyst

## Core Principles

### 1. Data First

ข้อมูลต้องเป็นพระเอก

ห้ามใช้ภาพ, Gradient, Animation หรือ Decoration มากจนบดบังข้อมูล

Priority:

```text
Data
↓
Hierarchy
↓
Readability
↓
Brand Identity
↓
Decoration
```

---

### 2. Clean by Default

Dark Mode เป็นประสบการณ์หลัก — Light Mode ยังคง clean เหมือนเดิมเมื่อสลับ

UI ต้องมี:

* White space
* Card ที่สะอาด
* Border บาง
* Shadow น้อย
* Typography ชัด
* สีแดงใช้เฉพาะจุดสำคัญ

หลีกเลี่ยง:

* Card ซ้อน Card ซ้อน Card
* Shadow หนัก
* Gradient เยอะ
* สีแดงเต็มหน้า
* Glassmorphism ที่ไม่มีเหตุผล
* Neon effect
* Dashboard แบบ Enterprise รุ่นเก่า

---

### 3. Premium Dark Mode

Dark Mode ไม่ใช่การกลับสีของ Light Mode แบบตรง ๆ

ต้องออกแบบเป็น Visual System แยก

Dark Mode มี mood:

```text
Premium
Sport
Technical
Focused
Cinematic
```

ใช้สีดำ / charcoal เป็นพื้น และใช้ Manchester United Red เป็น accent

---

### 4. Football Identity

Manchester United identity ต้องเห็นได้ชัด แต่ต้องไม่ทำให้ UI กลายเป็น:

```text
Fan Merchandise Website
```

ใช้ Brand Identity ผ่าน:

* Red Accent
* Typography
* Match presentation
* Player imagery
* Old Trafford imagery
* Subtle club references
* Match cards
* Football pitch visualization

ไม่ควรใส่ logo ซ้ำทุก Card

---

# 2. Theme Architecture

ระบบต้องรองรับ 2 Theme

```text
Light Theme
└── Default

Dark Theme
└── Optional
```

Theme switching ต้องทำผ่าน Design Tokens

ห้ามเขียนสีแบบ hard-code กระจายไปทั่ว component

ตัวอย่าง:

```css
background: var(--color-bg);
color: var(--color-text);
border-color: var(--color-border);
```

ไม่ควร:

```css
background: #ffffff;
```

กระจายทั่ว project

---

# 3. Light Theme

## Overall Mood

```text
Clean
Modern
Professional
Readable
Analytical
Sport-tech
```

Light Mode ต้องให้ความรู้สึกคล้าย:

```text
Modern SaaS
+
Sports Analytics
+
Editorial Football
```

---

## Light Color Tokens

### Brand

```text
--color-brand-primary: #DA291C
--color-brand-primary-hover: #B82016
--color-brand-primary-soft: #FDE8E6
```

Manchester United Red ใช้เป็น **Primary Accent**

ไม่ควรใช้เป็น background ขนาดใหญ่ในทุก section

---

### Background

```text
--color-bg: #F7F7F8
--color-bg-secondary: #F1F2F4
--color-surface: #FFFFFF
--color-surface-elevated: #FFFFFF
```

---

### Text

```text
--color-text-primary: #18181B
--color-text-secondary: #52525B
--color-text-muted: #71717A
--color-text-disabled: #A1A1AA
```

---

### Border

```text
--color-border: #E4E4E7
--color-border-light: #EFEFF1
```

Border ต้องบางและ subtle

---

### Data Colors

```text
--color-success: #16A34A
--color-success-soft: #DCFCE7

--color-warning: #D97706
--color-warning-soft: #FEF3C7

--color-danger: #DC2626
--color-danger-soft: #FEE2E2

--color-info: #2563EB
--color-info-soft: #DBEAFE
```

---

# 4. Dark Theme

Dark Mode ต้องให้ความรู้สึก Premium และ Technical

## Dark Color Tokens

```text
--color-bg: #0B0B0D
--color-bg-secondary: #101114
--color-surface: #151619
--color-surface-elevated: #1B1D21
```

---

## Dark Text

```text
--color-text-primary: #F5F5F5
--color-text-secondary: #B4B4BA
--color-text-muted: #85858D
--color-text-disabled: #55565C
```

---

## Dark Border

```text
--color-border: #292B30
--color-border-light: #202227
```

---

## Dark Brand

```text
--color-brand-primary: #DA291C
--color-brand-primary-hover: #EF3B2D
--color-brand-primary-soft: #3A1715
```

ห้ามใช้ pure black (`#000000`) เป็นทุก background

ควรใช้ layered charcoal:

```text
#0B0B0D
#101114
#151619
#1B1D21
```

เพื่อสร้าง depth

---

# 5. Typography

## Primary Recommendation

### IBM Plex Sans Thai Looped

ใช้เป็น **Primary Font**

เหตุผล:

* อ่านภาษาไทยดี
* ภาษาอังกฤษดู professional
* ตัวเลขอ่านง่าย
* เหมาะกับ Dashboard
* เหมาะกับ Data-heavy UI
* มี character ที่ทันสมัย
* ใช้ได้ทั้ง Light และ Dark Mode

```text
Thai:
IBM Plex Sans Thai Looped

English:
IBM Plex Sans
```

ถ้า ecosystem รองรับ variable font ให้ใช้ variable font

---

## Font Stack

```css
font-family:
  "IBM Plex Sans Thai Looped",
  "IBM Plex Sans",
  "Noto Sans Thai",
  sans-serif;
```

---

## Alternative Fonts

หาก IBM Plex Sans Thai Looped มีปัญหาด้าน rendering:

### Option 2

```text
Noto Sans Thai
+
Noto Sans
```

Mood:

```text
Neutral
Clean
Highly readable
```

### Option 3

```text
Anuphan
+
Inter
```

Mood:

```text
Modern
Friendly
SaaS
```

แต่ Primary Project Font ยังคงเป็น:

> IBM Plex Sans Thai Looped

---

# 6. Typography Scale

ใช้ Scale ที่ชัดเจน

```text
Display XL
48px / 56px / 700

Display
40px / 48px / 700

H1
32px / 40px / 700

H2
24px / 32px / 700

H3
20px / 28px / 600

H4
18px / 26px / 600

Body Large
16px / 26px / 400

Body
14px / 22px / 400

Body Small
13px / 20px / 400

Caption
12px / 18px / 400
```

---

# 7. Data Typography

ตัวเลขสำคัญต้องเด่นกว่าข้อความ

ตัวอย่าง:

```text
63%
Win Rate
```

ควรมี hierarchy:

```text
63%       ← 28–36px / 700
Win Rate  ← 12–14px / 400
```

---

## Number Formatting

ใช้ตัวเลขแบบชัดเจน

ตัวอย่าง:

```text
18
1.82
56%
14.2
2.31
```

ไม่ควรใช้ typography ที่ตกแต่งตัวเลขจนอ่านยาก

---

# 8. Language System

เว็บไซต์รองรับ:

```text
TH
EN
```

### Default

```text
TH
```

ภาษาไทยต้องเป็นภาษาหลักของ UI

---

## Language Switcher

แนะนำ:

```text
ไทย | EN
```

หรือ:

```text
TH ▼
```

ไม่ควรใช้ธงชาติเป็นตัวแทนภาษา

เพราะภาษา ≠ ประเทศ

---

## Translation Architecture

ห้ามเขียนข้อความ UI hard-code ใน component

ใช้ i18n

ตัวอย่าง:

```text
/locales
├── th.json
└── en.json
```

ตัวอย่าง:

```json
{
  "dashboard": {
    "title": "ภาพรวมผลงาน",
    "recentMatches": "ผลการแข่งขันล่าสุด",
    "nextMatch": "นัดถัดไป",
    "teamPerformance": "ผลงานของทีม"
  }
}
```

English:

```json
{
  "dashboard": {
    "title": "Performance Overview",
    "recentMatches": "Recent Matches",
    "nextMatch": "Next Match",
    "teamPerformance": "Team Performance"
  }
}
```

---

# 9. Navigation

Desktop:

```text
┌───────────────────────────────┐
│ Manchester United             │
│ Performance Analytics         │
├───────────────────────────────┤
│ ภาพรวม                        │
│ การแข่งขัน                    │
│ นักเตะ                        │
│ สถิติทีม                      │
│ แท็กติก                       │
│ ตารางคะแนน                    │
│                               │
│ ───────────────────────────   │
│ ตั้งค่า                        │
└───────────────────────────────┘
```

Recommended Navigation:

```text
ภาพรวม
การแข่งขัน
นักเตะ
สถิติ
แท็กติก
ตารางคะแนน
```

Optional:

```text
เปรียบเทียบ
รายงาน
```

---

## Active Navigation

Light:

```text
background: #FDE8E6
color: #DA291C
```

Dark:

```text
background: #3A1715
color: #EF3B2D
```

ไม่ใช้ red background เต็มแถบ

---

# 10. Header

Desktop Header:

```text
┌──────────────────────────────────────────────────────┐
│ Manchester United     ฤดูกาล 2025/26   ไทย  ☀/☾   │
└──────────────────────────────────────────────────────┘
```

ประกอบด้วย:

* Page title
* Season selector
* Language switcher
* Theme switcher
* Optional user/settings

---

# 11. Dashboard Layout

Default desktop:

```text
Sidebar
+
Main Content
```

Main Content:

```text
Page Header

Hero / Match Summary

KPI Row

Performance Chart

Recent Matches
+
Top Players

Tactical / Advanced Analytics
```

---

# 12. Grid System

Desktop:

```text
12-column grid
```

Recommended:

```text
Container max-width:
1440px

Gap:
16–24px
```

---

## Standard Grid

```text
1 column
2 columns
3 columns
4 columns
```

ห้ามทำ layout ที่ละเอียดเกินความจำเป็น

---

# 13. Responsive Breakpoints

```text
Mobile:
< 640px

Tablet:
640–1023px

Desktop:
1024–1279px

Large Desktop:
1280–1535px

Wide:
1536px+
```

---

## Mobile Rule

Mobile ไม่ใช่ Desktop ที่ถูกบีบ

ต้อง re-layout ใหม่

ตัวอย่าง:

Desktop:

```text
┌────────────┬────────────┬────────────┐
│ KPI        │ KPI        │ KPI        │
└────────────┴────────────┴────────────┘
```

Mobile:

```text
┌──────────────────────┐
│ KPI                  │
├──────────────────────┤
│ KPI                  │
├──────────────────────┤
│ KPI                  │
└──────────────────────┘
```

---

# 14. Cards

Card เป็น fundamental component

## Light

```text
background: #FFFFFF
border: 1px solid #E4E4E7
border-radius: 14–16px
box-shadow: 0 1px 3px rgba(...)
```

Shadow ต้อง subtle

---

## Dark

```text
background: #151619
border: 1px solid #292B30
border-radius: 14–16px
```

ไม่จำเป็นต้องใช้ shadow

---

# 15. Border Radius

ใช้ scale เดียวทั้งระบบ

```text
4px   → small controls
8px   → buttons / inputs
12px  → compact cards
16px  → standard cards
20px  → hero cards
999px → badges / pills
```

หลีกเลี่ยง radius แบบสุ่ม

---

# 16. Spacing System

ใช้ base 4px

```text
4
8
12
16
20
24
32
40
48
64
80
```

Primary spacing:

```text
Card padding:
20–24px

Section gap:
32–48px

Page padding:
24–40px
```

---

# 17. KPI Cards

KPI ต้องอ่านได้ภายใน 1–2 วินาที

ตัวอย่าง:

```text
┌────────────────────────┐
│ ชนะ                     │
│                         │
│ 18                      │
│ จาก 30 นัด              │
│                         │
│ ↑ 12% จากฤดูกาลก่อน    │
└────────────────────────┘
```

หรือ:

```text
ประตู
42

1.75 / นัด
```

ไม่ควรยัดข้อมูล 10 อย่างลง KPI Card เดียว

---

# 18. Match Card

Match Card ต้องมี hierarchy:

```text
การแข่งขัน
วันที่

Manchester United
      2 – 1
Brighton

Full Time

W
```

Team crest ต้องมีขนาดเล็กและชัด

Score เป็น visual focus

---

# 19. Match Result Colors

```text
Win:
Green

Draw:
Gray / Neutral

Loss:
Red
```

อย่าใช้สีแดงแทน Loss เสมอจนทำให้ brand color กับ performance meaning สับสน

Manchester United Red = Brand

Performance Red = Negative

ถ้าจำเป็นต้องแยก ให้ใช้เฉดสีต่างกัน

---

# 20. Charts

Chart ต้องอ่านง่ายก่อนสวย

## Primary Chart

ใช้:

```text
Line Chart
```

สำหรับ:

* Points
* Goals
* xG
* Form
* Performance trend

---

## Bar Chart

เหมาะกับ:

* Player comparison
* Goals
* Assists
* Shots
* Passing
* Defensive actions

---

## Area Chart

ใช้เมื่อมีเหตุผลด้าน trend

ห้ามใช้ gradient หนัก

---

## Donut Chart

ใช้เฉพาะ:

* Possession
* Win/Draw/Loss
* Distribution

ห้ามใช้ Donut Chart กับทุกอย่าง

---

# 21. Chart Colors

Light:

```text
Primary:
#DA291C

Secondary:
#52525B

Positive:
#16A34A

Negative:
#DC2626

Neutral:
#A1A1AA
```

Dark:

```text
Primary:
#EF3B2D

Secondary:
#B4B4BA

Positive:
#22C55E

Negative:
#F04438

Neutral:
#71717A
```

---

# 22. Data Visualization Rule

ห้ามใช้สีมากกว่า 5–6 สีใน Chart เดียวถ้าไม่จำเป็น

Priority:

```text
Primary data
→ Red

Comparison
→ Neutral Gray

Positive
→ Green

Negative
→ Red

Highlight
→ Brand Red
```

---

# 23. Performance Trend

Trend ต้องสื่อสารได้ทันที

ตัวอย่าง:

```text
ผลงาน 5 นัดล่าสุด

W   W   D   W   L
●   ●   ●   ●   ●
```

ใช้:

```text
W = ชนะ
D = เสมอ
L = แพ้
```

ไม่ต้องใส่ decoration เยอะ

---

# 24. Player Card

Player Card:

```text
┌──────────────────────────┐
│                          │
│       PLAYER IMAGE       │
│                          │
├──────────────────────────┤
│ Bruno Fernandes          │
│ กองกลาง                 │
│                          │
│ 8.2 Rating               │
│                          │
│ Goals     8              │
│ Assists   6              │
│ xG        7.2            │
└──────────────────────────┘
```

Player image สามารถใช้เป็น visual anchor

แต่ข้อมูลต้องอ่านง่าย

---

# 25. Player Comparison

ใช้ Table หรือ Horizontal Bar

ตัวอย่าง:

```text
ผู้เล่น             Rating

Bruno Fernandes     █████████░ 8.2
Amad Diallo         ████████░░ 7.8
Casemiro            ███████░░░ 7.2
```

หลีกเลี่ยง Radar Chart เป็น default

Radar Chart ใช้ได้เฉพาะเมื่อมีเหตุผลในการเปรียบเทียบหลาย dimension

---

# 26. Tactical View

Tactical View เป็น advanced section

องค์ประกอบ:

```text
Formation
Player Position
Possession
Pass Network
Heatmap
Pressing
Build-up
Chance Creation
```

Football Pitch:

* ใช้ dark green / neutral green
* เส้นสนาม subtle
* Player marker ชัด
* ไม่ใช้สีแดงทุก marker

---

# 27. Heatmap

Heatmap ต้องมี legend

```text
Low ───────────── High
```

และควรมี context:

```text
Heatmap
Manchester United
Last 5 Matches
Attacking Third
```

---

# 28. Tables

Table ต้องเหมาะกับ Data-heavy pages

Header:

```text
background: transparent / subtle surface
font-weight: 600
```

Row:

```text
min-height: 48–56px
```

Hover:

Light:

```text
#F7F7F8
```

Dark:

```text
#1B1D21
```

ไม่ควรใส่ border ทุก cell

ใช้ horizontal divider เป็นหลัก

---

# 29. Buttons

## Primary

Light:

```text
background: #DA291C
color: #FFFFFF
```

Dark:

```text
background: #DA291C
color: #FFFFFF
```

Hover:

```text
#B82016
```

---

## Secondary

Light:

```text
background: #FFFFFF
border: #E4E4E7
color: #18181B
```

Dark:

```text
background: #1B1D21
border: #292B30
color: #F5F5F5
```

---

# 30. Button Rule

ไม่ใช้ Red Button ทุก action

Hierarchy:

```text
Primary Action
→ Red

Secondary
→ Neutral

Destructive
→ Danger

Low Priority
→ Ghost
```

---

# 31. Filters

Filters สำคัญสำหรับ Analytics

ตัวอย่าง:

```text
ฤดูกาล
[ 2025/26 ▼ ]

การแข่งขัน
[ Premier League ▼ ]

ช่วงเวลา
[ 5 นัดล่าสุด ▼ ]

ผู้เล่น
[ ทั้งหมด ▼ ]
```

Desktop:

horizontal

Mobile:

stacked / bottom sheet

---

# 32. Search

Search สามารถใช้สำหรับ:

```text
ค้นหานักเตะ
ค้นหาการแข่งขัน
ค้นหาสถิติ
```

Placeholder:

Thai:

```text
ค้นหานักเตะ การแข่งขัน หรือสถิติ...
```

English:

```text
Search players, matches or statistics...
```

---

# 33. Hero Section

Hero ใช้กับ:

* Dashboard Overview
* Match Detail
* Player Detail

Hero สามารถใช้ภาพ Old Trafford หรือ Player Image

แต่ต้องไม่ให้ image overpower data

Recommended:

```text
Image
+
Dark overlay
+
Title
+
Key information
```

Light Mode สามารถใช้ image banner ที่สะอาด

Dark Mode สามารถใช้ cinematic image

---

# 34. Image Treatment

รูปนักเตะ:

```text
aspect-ratio:
16 / 9
4 / 3
1 / 1
```

Hero:

```text
16 / 6
```

Player:

```text
1 / 1
```

ใช้ object-fit:

```text
cover
```

---

# 35. Manchester United Branding

Brand elements ควรมีความ subtle

ใช้:

```text
Red
Black
White
Neutral Gray
```

Logo ใช้เฉพาะ:

* Header
* Team identity
* Match card
* Player/team context

ไม่ต้องใส่ logo ทุก Card

---

# 36. Iconography

ใช้ icon set เดียวทั้งระบบ

Recommended:

```text
Lucide
```

หรือ icon library ที่มี visual language ใกล้เคียง

Style:

```text
Outline
1.5–2px stroke
Minimal
```

ห้ามผสม:

```text
Filled Icon
+
3D Icon
+
Emoji
+
Outline Icon
```

ในระบบเดียวกันโดยไม่มีเหตุผล

---

# 37. Micro Interaction

Animation ต้องเร็วและ subtle

Recommended:

```text
150–200ms
```

ใช้กับ:

* Hover
* Theme switch
* Dropdown
* Sidebar
* Tab
* Tooltip

ห้ามใช้:

* Bounce
* Excessive parallax
* Continuous animation
* Auto-moving KPI
* Excessive loading animation

---

# 38. Loading State

ใช้ Skeleton

ตัวอย่าง:

```text
████████████████

████████
██████████████

████████████████████
```

ไม่ควรใช้ spinner เต็มหน้าทุกครั้ง

---

# 39. Empty State

ตัวอย่าง:

```text
ยังไม่มีข้อมูลการแข่งขัน

ข้อมูลจะแสดงเมื่อมีการแข่งขันในช่วงเวลาที่เลือก
```

ต้องมี explanation

ไม่ควร:

```text
No Data
```

อย่างเดียว

---

# 40. Error State

ใช้ข้อความที่มนุษย์อ่านเข้าใจ

ตัวอย่าง:

```text
ไม่สามารถโหลดข้อมูลได้

กรุณาลองใหม่อีกครั้ง
```

Button:

```text
ลองอีกครั้ง
```

---

# 41. Accessibility

ต้องรองรับ:

* Keyboard navigation
* Focus state
* Screen reader
* Color contrast
* Reduced motion

ห้ามใช้สีเพียงอย่างเดียวในการสื่อความหมาย

ตัวอย่าง:

ไม่ใช้:

```text
Green = Win
Red = Loss
```

อย่างเดียว

ควร:

```text
✓ ชนะ
− เสมอ
× แพ้
```

---

# 42. Dark Mode Accessibility

Dark Mode ต้องไม่ใช้:

```text
#FFFFFF
```

เป็น text ทุกอย่าง

ใช้ hierarchy:

```text
Primary:
#F5F5F5

Secondary:
#B4B4BA

Muted:
#85858D
```

ลด eye strain

---

# 43. Light Mode Accessibility

Background หลักไม่ควรขาวจ้าเต็มหน้า

ใช้:

```text
#F7F7F8
```

และ Card:

```text
#FFFFFF
```

เพื่อสร้าง visual hierarchy

---

# 44. Dashboard Information Hierarchy

ทุกหน้าต้องตอบคำถาม:

```text
1. ตอนนี้เกิดอะไรขึ้น?
2. ผลงานเป็นอย่างไร?
3. มีแนวโน้มอย่างไร?
4. ใครทำผลงานเด่น?
5. ทำไมผลงานถึงเป็นแบบนั้น?
```

ดังนั้น Dashboard:

```text
Overview
↓
Performance
↓
Trend
↓
Players
↓
Tactical Analysis
```

---

# 45. Page Types

Project ควรมี Page Structure ประมาณ:

```text
/pages

Dashboard
Matches
MatchDetail
Players
PlayerDetail
TeamStats
Tactics
Standings
Compare
Reports
Settings
```

---

# 46. Recommended Component Architecture

```text
/components

/layout
├── AppShell
├── Sidebar
├── Header
├── MobileNavigation
└── PageContainer

/ui
├── Button
├── Card
├── Badge
├── Tabs
├── Select
├── Input
├── Tooltip
├── Modal
└── Skeleton

/dashboard
├── KPI
├── PerformanceChart
├── FormIndicator
├── RecentMatches
├── NextMatch
└── TopPlayers

/matches
├── MatchCard
├── MatchTable
├── MatchHeader
├── ScoreDisplay
└── MatchTimeline

/players
├── PlayerCard
├── PlayerTable
├── PlayerStats
└── PlayerComparison

/tactics
├── FootballPitch
├── Formation
├── Heatmap
├── PassNetwork
└── TacticalStats

/charts
├── LineChart
├── BarChart
├── AreaChart
└── DonutChart
```

---

# 47. Design Token Architecture

แนะนำ:

```text
/design-system

colors
typography
spacing
radius
shadows
breakpoints
```

หรือรวม:

```text
/design-tokens
```

ทุก Component ต้องอ้างอิง Tokens

---

# 48. CSS Variables

ตัวอย่าง:

```css
:root {
  --color-brand-primary: #DA291C;

  --color-bg: #F7F7F8;
  --color-bg-secondary: #F1F2F4;

  --color-surface: #FFFFFF;

  --color-text-primary: #18181B;
  --color-text-secondary: #52525B;
  --color-text-muted: #71717A;

  --color-border: #E4E4E7;

  --color-success: #16A34A;
  --color-warning: #D97706;
  --color-danger: #DC2626;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
}
```

Dark:

```css
[data-theme="dark"] {
  --color-bg: #0B0B0D;
  --color-bg-secondary: #101114;

  --color-surface: #151619;

  --color-text-primary: #F5F5F5;
  --color-text-secondary: #B4B4BA;
  --color-text-muted: #85858D;

  --color-border: #292B30;
}
```

---

# 49. Theme Switching

Theme options:

```text
Light
Dark
System
```

UI:

```text
☀ Light
🌙 Dark
◐ System
```

แต่ Default:

```text
Light
```

ถ้า user เปลี่ยน theme ให้ persist preference

ตัวอย่าง:

```text
localStorage
```

หรือ user profile setting หากมี authentication

---

# 50. Language Switching

Options:

```text
ไทย
English
```

Default:

```text
ไทย
```

Language preference ต้อง persist

---

# 51. Date & Number Localization

Thai mode:

```text
17 ก.ย. 2569
```

English mode:

```text
17 Sep 2026
```

ต้องกำหนด strategy ให้ชัดเจน

สำหรับ football data ที่ต้องการ consistency สามารถใช้:

```text
17 Sep 2026
```

ใน analytical table

แต่หน้า UI ทั่วไปสามารถใช้ Thai localization

---

# 52. Terminology

ใช้คำศัพท์ไทยที่คนทั่วไปเข้าใจ

ตัวอย่าง:

```text
Performance
→ ผลงาน

Matches
→ การแข่งขัน

Players
→ นักเตะ

Statistics
→ สถิติ

Tactics
→ แท็กติก

Standings
→ ตารางคะแนน

Possession
→ การครองบอล

Pass Accuracy
→ ความแม่นยำในการจ่าย

Shots
→ จำนวนยิง

Shots on Target
→ ยิงเข้ากรอบ

Expected Goals
→ xG / ประตูที่คาดหวัง

Expected Assists
→ xA / แอสซิสต์ที่คาดหวัง

Clean Sheet
→ คลีนชีต

Win Rate
→ อัตราชนะ
```

---

# 53. Data Labels

เมื่อมีศัพท์ Analytics ให้แสดง abbreviation ได้

ตัวอย่าง:

```text
ประตูที่คาดหวัง (xG)
ความน่าจะเป็นของแอสซิสต์ (xA)
การครองบอล (Possession)
```

เมื่อ user เปิด English:

```text
Expected Goals (xG)
Expected Assists (xA)
Possession
```

---

# 54. UX Rule — Don't Overload

หน้า Dashboard ไม่ควรแสดงทุก metric ที่มี

Default:

```text
5–8 Primary KPIs
```

Advanced data:

```text
ดูรายละเอียด
```

หรือ:

```text
Advanced Statistics
```

---

# 55. Progressive Disclosure

ข้อมูลควรเปิดตามระดับ

### Level 1

```text
Score
Result
Goals
Possession
Shots
xG
```

### Level 2

```text
Passes
Progressive Passes
PPDA
Touches
Defensive Actions
```

### Level 3

```text
xThreat
Pass Network
Field Tilt
Pressing Zones
Shot Map
```

ไม่ควรโยน Level 3 ใส่ผู้ใช้ทันที

---

# 56. Dashboard Default View

เมื่อเปิดเว็บไซต์:

```text
Manchester United

ภาพรวมผลงาน
ฤดูกาล 2025/26
```

แสดง:

```text
Current Position
Points
Matches
Wins
Draws
Losses
Goals
Goals Against
Goal Difference
xG
```

ตามด้วย:

```text
ฟอร์มล่าสุด
แนวโน้มผลงาน
การแข่งขันล่าสุด
นัดถัดไป
นักเตะผลงานเด่น
```

---

# 57. Visual Balance

Target:

```text
60% Data
25% UI Structure
15% Brand / Imagery
```

ไม่ควร:

```text
50% Images
30% Decoration
20% Data
```

เว็บไซต์นี้เป็น Analytics Product

---

# 58. Dark vs Light Comparison

## Light

```text
Mood:
Clean / Modern / SaaS

Background:
#F7F7F8

Surface:
#FFFFFF

Primary:
#DA291C

Best for:
Daily usage
Data analysis
Tables
Charts
Long sessions
```

## Dark

```text
Mood:
Premium / Technical / Football

Background:
#0B0B0D

Surface:
#151619

Primary:
#DA291C

Best for:
Match analysis
Tactical view
Visual dashboards
Night usage
Presentation
```

---

# 59. Default Theme Decision

**Light Mode MUST be the default.**

เหตุผล:

* อ่านข้อมูลจำนวนมากได้ง่าย
* เหมาะกับ Dashboard
* เหมาะกับการใช้งานในสำนักงาน
* ตารางและ Chart อ่านง่าย
* เหมาะกับภาษาไทย
* ดู Modern SaaS มากกว่า Fan Site

Dark Mode เป็น optional personalization

---

# 60. Default Language Decision

**Thai MUST be the default language.**

English เป็น secondary language

Architecture ต้องรองรับการเพิ่มภาษาในอนาคตโดยไม่ต้องแก้ component หลัก

ตัวอย่าง:

```text
TH
EN
```

สามารถเพิ่ม:

```text
JP
AR
```

ในอนาคตได้โดยไม่ต้อง rewrite UI architecture

---

# 61. Agent Implementation Rules

Agent ที่พัฒนา project ต้องปฏิบัติตาม:

### Rule 1

ห้ามสร้าง Component ใหม่ถ้ามี Component ที่ทำหน้าที่เดียวกันอยู่แล้ว

---

### Rule 2

ห้าม hard-code สี

ใช้ Design Tokens

---

### Rule 3

ห้าม hard-code UI text

ใช้ i18n

---

### Rule 4

ห้ามสร้าง Dark Mode แบบ invert สี

Dark Mode ต้องใช้ Dark Tokens

---

### Rule 5

ห้ามใช้สีแดงมากเกินไป

Red = emphasis

ไม่ใช่:

```text
ทุก heading
ทุก button
ทุก card
ทุก chart
ทุก icon
```

---

### Rule 6

ห้ามใช้ animation เพื่อความสวยงามอย่างเดียว

Animation ต้องมี UX purpose

---

### Rule 7

Mobile ต้องได้รับการออกแบบจริง

ห้ามเพียงลด width ของ Desktop

---

### Rule 8

Data ต้องมี hierarchy

ผู้ใช้ต้องรู้:

```text
อะไรสำคัญ
อะไรเป็นรายละเอียด
อะไร interactive
```

ภายในไม่กี่วินาที

---

# 62. Visual Quality Checklist

ก่อนสร้างหน้าใหม่ Agent ต้องตรวจสอบ:

```text
[ ] Light Mode ดูดี
[ ] Dark Mode ดูดี
[ ] Thai typography อ่านง่าย
[ ] English typography อ่านง่าย
[ ] Mobile responsive
[ ] Tablet responsive
[ ] Desktop responsive
[ ] ไม่มี hard-coded colors
[ ] ใช้ design tokens
[ ] ใช้ i18n
[ ] Chart อ่านง่าย
[ ] Data hierarchy ชัด
[ ] ไม่ใช้ decoration มากเกินไป
[ ] Consistent spacing
[ ] Consistent radius
[ ] Consistent icon style
[ ] Accessible contrast
```

---

# 63. Final Visual Direction

เว็บไซต์ควรมีภาพรวมประมาณ:

```text
LIGHT MODE

Clean
████████████████████████

White Surface
Subtle Gray Background

Red Accent
        ↓
Manchester United Identity

Large Numbers
        ↓
Football Data

Minimal Charts
        ↓
Performance Story
```

Dark Mode:

```text
DARK MODE

Charcoal
████████████████████████

Premium Cards

Red Accent
        ↓
Football Identity

Strong Contrast
        ↓
Tactical / Analytics

Cinematic
        ↓
Professional
```

---

# 64. One Sentence Design Rule

> **“ทำให้มันดูเหมือนผลิตภัณฑ์ Football Analytics ระดับมืออาชีพที่มี Manchester United เป็น identity — ไม่ใช่เว็บแฟนบอลที่เอา Chart มาติดเพิ่มทีหลัง”**

---

# 65. Design North Star

ทุกครั้งก่อนสร้าง UI ใหม่ ให้ถาม:

```text
1. ข้อมูลนี้สำคัญกับผู้ใช้จริงหรือไม่?
2. ผู้ใช้เข้าใจได้ภายในไม่กี่วินาทีหรือไม่?
3. Light Mode อ่านง่ายหรือไม่?
4. Dark Mode ยังดู Premium หรือไม่?
5. ภาษาไทยดูเป็นธรรมชาติหรือไม่?
6. ภาษาอังกฤษยังไม่พังหรือไม่?
7. Component นี้ consistent กับระบบเดิมหรือไม่?
8. สีแดงถูกใช้เพื่อ emphasis หรือแค่ decoration?
9. Mobile ใช้งานจริงหรือไม่?
10. ถ้าลบ decoration ออก UI ยังใช้งานได้หรือไม่?
```

ถ้าคำตอบคือใช่เกือบทั้งหมด:

> **Ship it.**
