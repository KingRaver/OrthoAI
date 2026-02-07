import { describe, it, expect } from 'vitest'
import calculator from '@/app/lib/tools/handlers/calc'

describe('calculator', () => {
  it('evaluates simple arithmetic expressions', async () => {
    const result = await calculator({ expression: '2 + 2' })
    expect(result).toEqual({ expression: '2 + 2', result: 4 })
  })

  it('evaluates complex expressions', async () => {
    const result = await calculator({ expression: '(10 + 5) * 2' })
    expect(result).toEqual({ expression: '(10 + 5) * 2', result: 30 })
  })

  it('handles decimal results with precision', async () => {
    const result = await calculator({ expression: '1 / 3' })
    expect(result.result).toBeCloseTo(0.3333, 4)
  })

  it('throws error for invalid expression', async () => {
    await expect(calculator({ expression: 'invalid' })).rejects.toThrow('Invalid expression')
  })

  it('throws error for missing expression', async () => {
    await expect(calculator({} as { expression: string })).rejects.toThrow('Invalid expression: missing expression')
  })
})
