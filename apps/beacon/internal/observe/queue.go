package observe

import (
	"container/heap"
	"time"
)

// entry is a job and its schedule; owned by the scheduler goroutine.
type entry struct {
	job      Job
	next     time.Time
	failures int
	running  bool
	index    int // in the queue; -1 when not queued
}

// queue is a min-heap of entries by next poll time.
type queue []*entry

func (q queue) Len() int           { return len(q) }
func (q queue) Less(i, j int) bool { return q[i].next.Before(q[j].next) }
func (q queue) Swap(i, j int) {
	q[i], q[j] = q[j], q[i]
	q[i].index, q[j].index = i, j
}

func (q *queue) Push(x any) {
	e := x.(*entry)
	e.index = len(*q)
	*q = append(*q, e)
}

func (q *queue) Pop() any {
	old := *q
	e := old[len(old)-1]
	old[len(old)-1] = nil
	*q = old[:len(old)-1]
	e.index = -1
	return e
}

func (q *queue) push(e *entry) { heap.Push(q, e) }
func (q *queue) pop() *entry   { return heap.Pop(q).(*entry) }

// peek is the earliest entry (nil when empty).
func (q queue) peek() *entry {
	if len(q) == 0 {
		return nil
	}
	return q[0]
}

// fix restores the order after a queued entry's next time changed.
func (q *queue) fix(e *entry) { heap.Fix(q, e.index) }
