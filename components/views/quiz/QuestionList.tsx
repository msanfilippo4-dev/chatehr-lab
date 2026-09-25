"use client";

import { LETTERS, type Question, type ReviewItem } from "./types";

/** Questions with radio options; each question is a labelled fieldset. */
export function QuestionList({ name, questions, answers, disabled, onAnswer }: {
  name: string;
  questions: Question[];
  answers: (number | null)[];
  disabled?: boolean;
  onAnswer: (index: number, option: number) => void;
}) {
  return (
    <ol className="quiz-list">
      {questions.map((question, index) => (
        <li key={question.id} className="quiz-item">
          <fieldset>
            <legend className="quiz-stem">{question.question}</legend>
            <div className="quiz-options">
              {question.options.map((option, optionIndex) => {
                const chosen = answers[index] === optionIndex;
                return (
                  <label key={optionIndex} className={`quiz-option${chosen ? " chosen" : ""}`}>
                    <input
                      type="radio"
                      name={`${name}-${question.id}`}
                      value={optionIndex}
                      checked={chosen}
                      disabled={disabled}
                      onChange={() => onAnswer(index, optionIndex)}
                    />
                    <span className="quiz-letter" aria-hidden="true">{LETTERS[optionIndex]}</span>
                    <span>{option}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </li>
      ))}
    </ol>
  );
}

/** Per-question review: the student's answer, the correct answer, and the rationale. */
export function ReviewList({ items }: { items: ReviewItem[] }) {
  return (
    <ol className="quiz-list">
      {items.map((item) => (
        <li key={item.id} className="quiz-item">
          <p className="quiz-stem">{item.question}</p>
          <ul className="quiz-options quiz-review-options">
            {item.options.map((option, optionIndex) => {
              const isCorrect = optionIndex === item.correct;
              const isChosen = optionIndex === item.selected;
              const classes = ["quiz-option", isChosen ? "chosen" : "", isCorrect ? "correct" : "", isChosen && !isCorrect ? "wrong" : ""];
              return (
                <li key={optionIndex} className={classes.filter(Boolean).join(" ")}>
                  <span className="quiz-mark" aria-hidden="true">{isCorrect ? "✓" : isChosen ? "✗" : ""}</span>
                  <span className="quiz-letter">{LETTERS[optionIndex]}</span>
                  <span>
                    {option}
                    {isChosen && <span className="sr-only"> (your answer{isCorrect ? ", correct" : ", incorrect"})</span>}
                    {isCorrect && !isChosen && <span className="sr-only"> (correct answer)</span>}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="quiz-verdict">
            {item.selected == null ? "Not answered. " : item.isCorrect ? "Correct. " : `Your answer: ${LETTERS[item.selected]}. `}
            {!item.isCorrect && <>Correct answer: <strong>{LETTERS[item.correct]}</strong>.</>}
          </p>
          <p className="quiz-rationale">
            {item.rationale}
            {item.book && <small className="quiz-book"> {item.book}</small>}
          </p>
        </li>
      ))}
    </ol>
  );
}
