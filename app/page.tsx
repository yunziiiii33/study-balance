"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, Clock3, Plus, RotateCcw, Scale, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Category = "전공" | "교양" | "미분류";
type Level = "적음" | "보통" | "많음";
type Confidence = "낮음" | "보통" | "높음";
type Subject = { id: number; name: string; category: Category; credits: string; examDate: string; workload: Level; confidence: Confidence; selected: boolean; color: string };
type Allocation = Subject & { minutes: number; percent: number; score: number; daysLeft: number };

declare global {
  interface Document {
    modelContext?: {
      registerTool: (tool: Record<string, unknown>, options?: { signal?: AbortSignal }) => void | Promise<void>;
    };
  }
}

const DEMO_TODAY = new Date("2026-10-12T00:00:00");
const COLORS = ["#3154D8", "#7A4FDA", "#0E9F84", "#E6783B", "#C04473"];
const initialSubjects: Subject[] = [
  { id: 1, name: "경제학원론", category: "전공", credits: "3", examDate: "2026-10-15", workload: "많음", confidence: "낮음", selected: true, color: COLORS[0] },
  { id: 2, name: "통계학", category: "전공", credits: "3", examDate: "2026-10-17", workload: "보통", confidence: "보통", selected: true, color: COLORS[1] },
  { id: 3, name: "글쓰기", category: "교양", credits: "2", examDate: "2026-10-19", workload: "적음", confidence: "높음", selected: true, color: COLORS[2] },
];
const workloadFactor: Record<Level, number> = { 적음: 1, 보통: 1.5, 많음: 2 };
const confidenceFactor: Record<Confidence, number> = { 높음: 1, 보통: 1.25, 낮음: 1.5 };

function daysUntil(dateString: string) {
  const exam = new Date(`${dateString}T00:00:00`);
  return Math.max(1, Math.ceil((exam.getTime() - DEMO_TODAY.getTime()) / 86400000));
}

function calculate(subjects: Subject[], totalMinutes: number): Allocation[] {
  const active = subjects.filter((subject) => subject.selected);
  const scored = active.map((subject) => {
    const daysLeft = daysUntil(subject.examDate);
    const creditValue = subject.credits ? Number(subject.credits) / 3 : 1;
    const majorValue = subject.category === "전공" ? 1.2 : 1;
    const score = workloadFactor[subject.workload] * confidenceFactor[subject.confidence] * majorValue * creditValue / daysLeft;
    return { ...subject, score, daysLeft };
  });
  const fixed = new Map<number, number>();
  let flexible = [...scored];
  let remaining = totalMinutes;
  while (flexible.length) {
    const scoreSum = flexible.reduce((sum, subject) => sum + subject.score, 0);
    const tooSmall = flexible.filter((subject) => remaining * subject.score / scoreSum < 10);
    if (!tooSmall.length) break;
    tooSmall.forEach((subject) => fixed.set(subject.id, 10));
    remaining -= tooSmall.length * 10;
    flexible = flexible.filter((subject) => !fixed.has(subject.id));
  }
  const scoreSum = flexible.reduce((sum, subject) => sum + subject.score, 0);
  const raw = flexible.map((subject) => ({ ...subject, rawMinutes: scoreSum ? remaining * subject.score / scoreSum : 0 }));
  const rounded = new Map<number, number>(raw.map((subject) => [subject.id, Math.floor(subject.rawMinutes / 10) * 10]));
  let leftover = remaining - [...rounded.values()].reduce((sum, value) => sum + value, 0);
  const order = [...raw].sort((a, b) => (b.rawMinutes % 10) - (a.rawMinutes % 10) || active.findIndex((s) => s.id === a.id) - active.findIndex((s) => s.id === b.id));
  let index = 0;
  while (leftover >= 10 && order.length) {
    const subject = order[index % order.length];
    rounded.set(subject.id, (rounded.get(subject.id) ?? 0) + 10);
    leftover -= 10;
    index += 1;
  }
  return scored.map((subject) => {
    const minutes = fixed.get(subject.id) ?? rounded.get(subject.id) ?? 0;
    return { ...subject, minutes, percent: Math.round(minutes / totalMinutes * 100) };
  }).sort((a, b) => b.minutes - a.minutes || b.score - a.score);
}

function reasonFor(subject: Allocation) {
  const parts = [`시험까지 ${subject.daysLeft}일`, `공부량 ${subject.workload}`];
  if (subject.confidence !== "보통") parts.push(`자신감 ${subject.confidence}`);
  if (subject.category === "전공") parts.push("전공 가중치 1.2배");
  parts.push(subject.credits ? `${subject.credits}학점 반영` : "학점 미반영");
  return parts.join(" · ");
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-2 block text-[0.78rem] font-bold tracking-[-0.01em] text-[#66708A]">{children}</span>;
}

function Header() {
  return <header className="border-b border-[#E1E5EE] bg-white/85 backdrop-blur-xl"><div className="mx-auto flex h-[72px] w-full max-w-[1180px] items-center justify-between px-5 sm:px-8"><div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-xl bg-[#3154D8] text-white shadow-[0_6px_16px_rgba(49,84,216,.24)]"><Scale className="size-5" /></span><span className="text-lg font-black tracking-[-0.04em]">공부 저울</span></div><span className="rounded-full border border-[#DDE2EC] bg-[#F7F8FB] px-3 py-1.5 text-xs font-bold text-[#737D94]">시연용 목업</span></div></header>;
}

export default function Home() {
  const [subjects, setSubjects] = useState(initialSubjects);
  const [hours, setHours] = useState("3");
  const [minutes, setMinutes] = useState("0");
  const [view, setView] = useState<"input" | "result">("input");
  const [error, setError] = useState("");
  const selected = subjects.filter((subject) => subject.selected);
  const totalMinutes = Math.max(0, Number(hours || 0) * 60 + Number(minutes || 0));
  const results = useMemo(() => calculate(subjects, totalMinutes || 10), [subjects, totalMinutes]);

  const updateSubject = <K extends keyof Subject>(id: number, key: K, value: Subject[K]) => setSubjects((current) => current.map((subject) => subject.id === id ? { ...subject, [key]: value } : subject));
  const addSubject = () => {
    const id = Math.max(0, ...subjects.map((subject) => subject.id)) + 1;
    setSubjects((current) => [...current, { id, name: "새 과목", category: "미분류", credits: "", examDate: "2026-10-20", workload: "보통", confidence: "보통", selected: true, color: COLORS[(id - 1) % COLORS.length] }]);
  };
  const validateAndCalculate = () => {
    if (!selected.length) return setError("오늘 공부할 과목을 하나 이상 선택해주세요.");
    if (selected.some((subject) => !subject.name.trim())) return setError("선택한 과목의 이름을 입력해주세요.");
    if (totalMinutes % 10 !== 0) return setError("공부 시간은 10분 단위로 입력해주세요.");
    if (totalMinutes < selected.length * 10) return setError(`${selected.length}과목을 배분하려면 최소 ${selected.length * 10}분이 필요해요.`);
    setError(""); setView("result"); window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    if (!document.modelContext?.registerTool) return;
    const lifecycle = new AbortController();
    const context = document.modelContext;
    void Promise.resolve(context.registerTool({
      name: "calculate_study_balance",
      title: "공부 비중 계산",
      description: "현재 선택된 과목을 사용해 입력한 총 공부 시간을 배분하고 결과 화면을 연다.",
      inputSchema: {
        type: "object",
        properties: { totalMinutes: { type: "integer", minimum: 10, multipleOf: 10 } },
        required: ["totalMinutes"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input: unknown) {
        const value = (input as { totalMinutes?: unknown })?.totalMinutes;
        if (!Number.isInteger(value) || (value as number) < selected.length * 10 || (value as number) % 10 !== 0) {
          throw new Error(`선택한 ${selected.length}과목에는 10분 단위로 최소 ${selected.length * 10}분이 필요합니다.`);
        }
        const nextMinutes = value as number;
        setHours(String(Math.floor(nextMinutes / 60)));
        setMinutes(String(nextMinutes % 60));
        setError("");
        setView("result");
        return { totalMinutes: nextMinutes, selectedSubjects: selected.map((subject) => subject.name), status: "calculated" };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, [selected]);

  if (view === "result") {
    const first = results[0];
    return <main className="min-h-screen bg-[#F4F6FB] text-[#17203A]">
      <Header />
      <section className="mx-auto w-full max-w-[1180px] px-5 pb-20 pt-10 sm:px-8 lg:pt-14">
        <button className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-[#66708A] transition hover:text-[#3154D8]" onClick={() => setView("input")}><ArrowLeft className="size-4" /> 조건 수정하기</button>
        <div className="result-hero relative overflow-hidden rounded-[2rem] bg-[#17203A] px-6 py-8 text-white shadow-[0_24px_70px_rgba(23,32,58,.18)] sm:px-10 sm:py-10">
          <div className="relative z-10 max-w-3xl"><div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-white/80"><Sparkles className="size-3.5 text-[#7CE7D0]" /> 오늘의 공부 비중</div><p className="text-sm font-semibold text-white/60">총 {totalMinutes}분 · {results.length}과목</p><h1 className="mt-2 text-[clamp(2rem,5vw,4rem)] font-black leading-[1.08] tracking-[-0.055em]">{first.name}부터<br />{first.minutes}분 시작해보세요.</h1><p className="mt-5 max-w-xl text-sm leading-6 text-white/65">시험 일정과 공부량, 자신감, 수강 학점을 함께 반영한 시연용 배분이에요.</p></div>
          <div className="balance-orbit" aria-hidden="true"><Scale className="size-10" /></div>
        </div>
        <section className="mt-8 rounded-[1.7rem] border border-[#DFE4F0] bg-white p-5 shadow-[0_12px_40px_rgba(23,32,58,.06)] sm:p-8">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#7B849B]">Time balance</p><h2 className="mt-1 text-2xl font-black tracking-[-0.035em]">한눈에 보는 {totalMinutes}분</h2></div><span className="rounded-full bg-[#F1F3F8] px-3 py-1.5 text-xs font-bold text-[#66708A]">10분 단위 배분</span></div>
          <div className="flex h-16 overflow-hidden rounded-2xl bg-[#EEF1F7] p-1.5" aria-label="과목별 공부 시간 비율">{results.map((subject) => <div key={subject.id} className="flex min-w-[42px] items-center justify-center overflow-hidden rounded-xl text-sm font-black text-white transition-all" style={{ width: `${subject.percent}%`, backgroundColor: subject.color }} title={`${subject.name} ${subject.minutes}분`}><span className="hidden px-2 sm:inline">{subject.minutes}분</span></div>)}</div>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">{results.map((subject) => <div key={subject.id} className="flex items-center gap-2 text-sm font-bold text-[#4E5872]"><span className="size-2.5 rounded-full" style={{ backgroundColor: subject.color }} />{subject.name} {subject.minutes}분</div>)}</div>
        </section>
        <div className="mt-6 grid gap-4">{results.map((subject, index) => <article key={subject.id} className="group grid gap-5 rounded-[1.5rem] border border-[#DFE4F0] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-[0_14px_40px_rgba(23,32,58,.08)] sm:grid-cols-[1fr_auto] sm:items-center sm:p-7"><div className="flex gap-4"><div className="flex size-11 shrink-0 items-center justify-center rounded-2xl text-lg font-black text-white" style={{ backgroundColor: subject.color }}>{index + 1}</div><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-xl font-black tracking-[-0.025em]">{subject.name}</h3>{index === 0 && <span className="rounded-full bg-[#E8F8F4] px-2.5 py-1 text-[0.7rem] font-extrabold text-[#087966]">먼저 시작</span>}<span className="rounded-full bg-[#F1F3F8] px-2.5 py-1 text-[0.7rem] font-extrabold text-[#66708A]">{subject.category}{subject.credits ? ` · ${subject.credits}학점` : ""}</span></div><p className="mt-2 text-sm leading-6 text-[#66708A]">{reasonFor(subject)}</p></div></div><div className="border-t border-[#E7EAF2] pt-4 text-left sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0 sm:text-right"><p className="text-4xl font-black tracking-[-0.05em]" style={{ color: subject.color }}>{subject.minutes}<span className="ml-1 text-base tracking-normal text-[#7B849B]">분</span></p><p className="mt-1 text-xs font-bold text-[#9AA1B3]">전체의 {subject.percent}%</p></div></article>)}</div>
        <div className="mt-8 flex flex-col items-stretch justify-between gap-4 rounded-2xl border border-dashed border-[#C9D0DF] bg-white/60 p-5 sm:flex-row sm:items-center"><p className="text-sm leading-6 text-[#66708A]"><strong className="text-[#17203A]">시연용 계산 결과</strong><br />검증된 최적 학습법이 아니며, 입력한 조건을 비교하기 위한 기준이에요.</p><Button onClick={() => setView("input")} variant="outline" size="lg" className="h-12 rounded-xl border-[#CBD2E2] bg-white px-5 font-extrabold"><RotateCcw /> 조건 수정하기</Button></div>
      </section>
    </main>;
  }

  return <main className="min-h-screen bg-[#F4F6FB] text-[#17203A]">
    <Header />
    <section className="mx-auto w-full max-w-[1180px] px-5 pb-24 pt-9 sm:px-8 lg:pt-12">
      <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#D7DDF0] bg-white px-3 py-1.5 text-xs font-extrabold text-[#526084]"><BookOpen className="size-3.5 text-[#3154D8]" /> 가상 샘플 · 기준일 2026.10.12</div><h1 className="text-[clamp(2rem,4.7vw,4.2rem)] font-black leading-[1.04] tracking-[-0.06em]">오늘의 시간을<br /><span className="text-[#3154D8]">공부 비중</span>으로 바꿔보세요.</h1></div><p className="max-w-sm text-[0.96rem] font-medium leading-7 text-[#66708A]">시험까지 남은 기간, 공부량, 자신감, 수강 학점을 비교해 무엇부터 얼마나 공부할지 보여드려요.</p></div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_330px] lg:items-start">
        <section className="rounded-[1.7rem] border border-[#DFE4F0] bg-white p-5 shadow-[0_14px_48px_rgba(23,32,58,.055)] sm:p-7">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[#E8EBF2] pb-5"><div><p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#7B849B]">My subjects</p><h2 className="mt-1 text-2xl font-black tracking-[-0.035em]">내 과목 구성</h2></div><Button onClick={addSubject} variant="outline" className="h-10 rounded-xl border-[#CBD2E2] px-4 font-extrabold"><Plus /> 과목 추가</Button></div>
          <div className="grid gap-4">{subjects.length === 0 ? <div className="rounded-2xl border border-dashed border-[#C9D0DF] bg-[#F8F9FC] px-5 py-12 text-center"><p className="font-bold text-[#66708A]">시험 볼 과목을 추가해주세요.</p><Button onClick={addSubject} className="mt-4 rounded-xl bg-[#3154D8]"><Plus /> 과목 추가</Button></div> : subjects.map((subject, index) => <SubjectCard key={subject.id} subject={subject} index={index} update={updateSubject} remove={() => setSubjects((current) => current.filter((item) => item.id !== subject.id))} />)}</div>
        </section>
        <aside className="lg:sticky lg:top-6"><div className="overflow-hidden rounded-[1.7rem] bg-[#17203A] text-white shadow-[0_20px_55px_rgba(23,32,58,.2)]"><div className="p-6 sm:p-7"><div className="mb-6 flex items-center justify-between"><div className="flex size-11 items-center justify-center rounded-2xl bg-white/10"><Clock3 className="size-5 text-[#7CE7D0]" /></div><span className="text-xs font-bold text-white/45">10분 단위</span></div><h2 className="text-2xl font-black tracking-[-0.04em]">오늘 공부할 시간</h2><p className="mt-2 text-sm leading-6 text-white/55">목표로 하거나 실제로 확보한 시간을 입력해주세요.</p><div className="mt-6 grid grid-cols-[1fr_auto_1fr_auto] items-end gap-2"><label><FieldLabel>시간</FieldLabel><Input type="number" min="0" value={hours} onChange={(event) => setHours(event.target.value)} className="h-14 rounded-xl border-white/15 bg-white/10 text-center text-2xl font-black text-white shadow-none focus-visible:border-[#7CE7D0] focus-visible:ring-[#7CE7D0]/20 md:text-2xl" /></label><span className="pb-4 text-sm font-bold text-white/50">시간</span><label><FieldLabel>분</FieldLabel><Input type="number" min="0" step="10" value={minutes} onChange={(event) => setMinutes(event.target.value)} className="h-14 rounded-xl border-white/15 bg-white/10 text-center text-2xl font-black text-white shadow-none focus-visible:border-[#7CE7D0] focus-visible:ring-[#7CE7D0]/20 md:text-2xl" /></label><span className="pb-4 text-sm font-bold text-white/50">분</span></div><div className="my-6 h-px bg-white/10" /><div className="flex items-center justify-between text-sm"><span className="font-semibold text-white/55">선택한 과목</span><strong className="text-lg">{selected.length}개</strong></div><div className="mt-3 flex items-center justify-between text-sm"><span className="font-semibold text-white/55">총 공부 시간</span><strong className="text-lg">{totalMinutes}분</strong></div><div className="mt-5 flex flex-wrap gap-2">{selected.map((subject) => <span key={subject.id} className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-2.5 py-1.5 text-xs font-bold text-white/70"><span className="size-1.5 rounded-full" style={{ backgroundColor: subject.color }} />{subject.name}</span>)}</div>{error && <p role="alert" className="mt-5 rounded-xl border border-[#F28CA4]/30 bg-[#C3425F]/20 px-4 py-3 text-sm font-semibold leading-5 text-[#FFD9E2]">{error}</p>}</div><Button onClick={validateAndCalculate} className="h-16 w-full rounded-none bg-[#3154D8] text-base font-black hover:bg-[#2748C6]">공부 비중 계산하기 <ArrowRight className="size-5" /></Button></div><div className="mt-4 rounded-2xl border border-[#DCE2EC] bg-white p-5"><div className="flex items-start gap-3"><div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-[#E8F8F4] text-[#087966]"><Check className="size-4" /></div><p className="text-xs font-semibold leading-5 text-[#66708A]">전공은 1.2배로 반영해요. 학점을 비워두면 시험 일정·공부량·자신감만으로 계산합니다.</p></div></div></aside>
      </div>
    </section>
  </main>;
}

function SubjectCard({ subject, index, update, remove }: { subject: Subject; index: number; update: <K extends keyof Subject>(id: number, key: K, value: Subject[K]) => void; remove: () => void }) {
  return <article className={`rounded-2xl border p-4 transition sm:p-5 ${subject.selected ? "border-[#C7D1F5] bg-[#F9FAFE] shadow-[0_5px_18px_rgba(49,84,216,.05)]" : "border-[#E4E7EF] bg-white opacity-65"}`}><div className="mb-4 flex items-center gap-3"><Checkbox checked={subject.selected} onCheckedChange={(checked) => update(subject.id, "selected", checked === true)} aria-label={`${subject.name} 선택`} className="size-5 border-[#B8C0D2] data-[state=checked]:border-[#3154D8] data-[state=checked]:bg-[#3154D8]" /><span className="h-8 w-1 rounded-full" style={{ backgroundColor: subject.color }} /><Input value={subject.name} onChange={(event) => update(subject.id, "name", event.target.value)} aria-label={`과목 ${index + 1} 이름`} className="h-10 flex-1 border-0 bg-transparent px-1 text-lg font-black shadow-none focus-visible:ring-0 md:text-lg" /><Button type="button" variant="ghost" size="icon" aria-label={`${subject.name} 삭제`} className="rounded-xl text-[#9AA1B3] hover:bg-[#FDECEF] hover:text-[#C3425F]" onClick={remove}><Trash2 /></Button></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
    <label><FieldLabel>구분</FieldLabel><Select value={subject.category} onValueChange={(value) => update(subject.id, "category", value as Category)}><SelectTrigger className="h-11 w-full rounded-xl border-[#D9DEEA] bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="전공">전공</SelectItem><SelectItem value="교양">교양</SelectItem><SelectItem value="미분류">미분류</SelectItem></SelectContent></Select></label>
    <label><FieldLabel>수강 학점</FieldLabel><Select value={subject.credits || "none"} onValueChange={(value) => update(subject.id, "credits", value === "none" ? "" : value)}><SelectTrigger className="h-11 w-full rounded-xl border-[#D9DEEA] bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">미입력</SelectItem><SelectItem value="1">1학점</SelectItem><SelectItem value="2">2학점</SelectItem><SelectItem value="3">3학점</SelectItem><SelectItem value="4">4학점</SelectItem></SelectContent></Select></label>
    <label className="col-span-2 sm:col-span-1"><FieldLabel>시험 날짜</FieldLabel><Input type="date" value={subject.examDate} min="2026-10-12" onChange={(event) => update(subject.id, "examDate", event.target.value)} className="h-11 rounded-xl border-[#D9DEEA] bg-white" /></label>
    <label><FieldLabel>남은 공부량</FieldLabel><Select value={subject.workload} onValueChange={(value) => update(subject.id, "workload", value as Level)}><SelectTrigger className="h-11 w-full rounded-xl border-[#D9DEEA] bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="적음">적음</SelectItem><SelectItem value="보통">보통</SelectItem><SelectItem value="많음">많음</SelectItem></SelectContent></Select></label>
    <label><FieldLabel>자신감</FieldLabel><Select value={subject.confidence} onValueChange={(value) => update(subject.id, "confidence", value as Confidence)}><SelectTrigger className="h-11 w-full rounded-xl border-[#D9DEEA] bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="낮음">낮음</SelectItem><SelectItem value="보통">보통</SelectItem><SelectItem value="높음">높음</SelectItem></SelectContent></Select></label>
  </div></article>;
}
