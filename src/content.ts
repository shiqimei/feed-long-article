import type { PlasmoCSConfig } from 'plasmo'
import GPT3Tokenizer from 'gpt3-tokenizer'
import debounce from 'lodash/debounce'

export const config: PlasmoCSConfig = {
  matches: ['https://chat.openai.com/*'],
  all_frames: true
}

const style = document.createElement('style')
style.innerHTML = `
.dark.hidden { display: flex; }
.textarea-container { flex-direction: row; }
.textarea-container textarea~button svg { display: none; }
`.trim()
document.head.appendChild(style)

const title = document.querySelector('title')
let previousUrl = ''

observeMutations(title, () => {
  const url = location.href
  console.log(document.title)
  previousUrl = url
  setUpSendButton()
})
setUpSendButton()

function observeMutations(targetElement, callback) {
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      if (mutation.type === 'childList' && mutation.target === targetElement) {
        callback(mutation)
      }
    })
  })
  observer.observe(targetElement, { childList: true })
  return observer
}

function setUpSendButton() {
  const hasRegisteredButton = document.querySelector('#ChatGPTSendButton')
  if (hasRegisteredButton != null) {
    console.log('The button has alrady been registered')
    return
  }
  const textarea = document.querySelector('main textarea') as HTMLTextAreaElement
  const grandParentElement = textarea.parentElement.parentElement as HTMLDivElement
  const button = document.createElement('button')
  button.id = 'ChatGPTSendButton'
  const tokensPresenter = document.createElement('div')

  grandParentElement.classList.add('textarea-container')
  button.setAttribute(
    'style',
    stylesToString({
      color: 'rgb(142, 142, 160)',
      height: '50px',
      width: '75px',
      background: 'rgb(64, 65, 79)',
      'margin-left': '5px',
      'border-radius': '6px',
      'font-size': '14px',
      'box-shadow': '0 0 20px 0 rgba(0, 0, 0, 0.15)',
      'user-select': 'none',
      border: '1px solid rgba(32, 33, 35, 0.5)',
      display: 'inline-flex',
      'align-items': 'center',
      'justify-content': 'center'
    })
  )
  tokensPresenter.setAttribute(
    'style',
    stylesToString({
      color: 'rgb(142, 142, 160)',
      height: '20px',
      'margin-left': '5px',
      'border-radius': '6px',
      'font-size': '12px',
      display: 'inline-flex',
      'align-items': 'center',
      'justify-content': 'center',
      position: 'absolute',
      right: '80px',
      bottom: '-20px'
    })
  )
  textarea.oninput = debounce(() => {
    const content = textarea.value
    if (content == null) return
    const tokenizer = new GPT3Tokenizer({ type: 'gpt3' })
    const compressedContent = removeWhiteChars(content)
    const tokens = tokenizer.encode(compressedContent).text.length
    if (tokens > 3072) {
      tokensPresenter.style.setProperty('color', 'red')
    } else {
      tokensPresenter.style.setProperty('color', 'rgb(142, 142, 160)')
    }
    tokensPresenter.innerText = `${tokens} tokens`
  }, 500)

  grandParentElement.removeChild(grandParentElement.childNodes[0])
  grandParentElement.appendChild(button)
  grandParentElement.appendChild(tokensPresenter)
  tokensPresenter.innerText = '0 tokens'
  button.innerText = 'Send'

  let splitCount = 0
  let splits = []
  button.addEventListener('click', () => {
    const article = textarea.value
    if (splits.length <= 0) {
      if (!article || article == null) return
      textarea.value = ''

      const parts = splitContentIntoParts(article, textarea)
      if (parts.length <= 1) {
        textarea.value = parts[0]
        return
      }
      splits = parts
      splitCount = splits.length

      button.innerText = `${splitCount}/${splitCount}`
    } else {
      textarea.value = splits.shift()
      if (splits.length === 0) {
        button.innerText = 'Send'
      } else {
        button.innerText = `${splits.length}/${splitCount}`
      }
    }
  })
}

function stylesToString(styles: Record<string, string>) {
  return Object.entries(styles).reduce((str, [key, value]) => {
    return str ? `${str};${key}:${value}` : `${key}:${value}`
  }, '')
}

function splitContentIntoParts(str: string, textarea: HTMLTextAreaElement): string[] {
  const compressedContent = removeWhiteChars(str)
  const tokenizer = new GPT3Tokenizer({ type: 'gpt3' })
  const tokens = tokenizer.encode(compressedContent).text.length
  const MAX_TOKENS_PER_MESSAGE = 3072 // 3000 tokens per input
  const diviedParts = Math.ceil(tokens / MAX_TOKENS_PER_MESSAGE)
  console.log({ rawString: str, tokens, diviedParts })
  const ret = divideString(str, diviedParts)
  if (diviedParts > 1) {
    textarea.value =
      "I'll share you with an article, I'll continue to input util I say FINISH." +
      'You should say "OK" before I say "FINISH". NO EXTRA EXPLAINATION!'
  }
  return ret
}

function removeWhiteChars(str: string) {
  return str
    .replace(/(\n|\t)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function divideString(input: string, parts: number): string[] {
  const separators = ['.', ',', ' ']
  const result: string[] = []

  // This function finds and returns the first valid separator . (dot) , (comma) or  (space)
  // that is not part of a link in the given string.
  // If no valid separator is found, it returns an empty string.
  const findSeparator = (str: string): string => {
    const regex = /(https?:\/\/[^\s]+)/g
    const links: string[] = []
    let match

    while ((match = regex.exec(str)) !== null) {
      links.push(match[0])
    }

    for (const sep of separators) {
      if (str.includes(sep)) {
        let isValidSeparator = true
        for (const link of links) {
          if (link.includes(sep)) {
            const indexInLink = link.indexOf(sep)
            const indexInStr = str.indexOf(link) + indexInLink
            if (str.indexOf(sep) === indexInStr) {
              isValidSeparator = false
              break
            }
          }
        }

        if (isValidSeparator) {
          return sep
        }
      }
    }

    return ''
  }

  const idealLength = Math.floor(input.length / parts)
  const maxDifference = 100

  let remaining = input
  while (result.length < parts - 1) {
    let splitIndex = idealLength
    let separator = ''

    while (splitIndex > 0) {
      separator = findSeparator(
        remaining.slice(splitIndex - maxDifference, splitIndex + maxDifference)
      )
      if (separator !== '') {
        splitIndex = remaining.indexOf(separator, splitIndex - maxDifference)
        break
      }
      splitIndex--
    }

    if (splitIndex <= 0) {
      splitIndex = remaining.lastIndexOf(findSeparator(remaining), idealLength)
      if (splitIndex === -1) {
        splitIndex = idealLength
      }
    }

    result.push(remaining.slice(0, splitIndex + 1))
    remaining = remaining.slice(splitIndex + 1)
  }

  result.push(remaining)
  return result
}
