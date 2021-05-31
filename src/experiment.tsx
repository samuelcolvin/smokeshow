import {simple_response} from './utils'
import {async_ref} from './jsx/jsx-runtime'

async function render_jsx(raw: any): Promise<string> {
  // console.log('raw:', raw)
  const prom = raw as Promise<string>
  return await prom
}

const Foobar = ({thing}: {thing: number}) => <span>Number: {thing}</span>

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function get_thing(x: number): Promise<number> {
  await sleep(x)
  return 42
}

function DoWait({x}: {x: number}) {
  const answer = async_ref(get_thing(x))
  return (
    <>
      <div>answer: {answer}</div>
      <Foobar thing={answer}/>
    </>
  )
}

const HasInner = ({children}: {children: JSX.Element}) => {
  return <div className="this-takes-inner">{children}</div>
}

function foobar() {
  return (
    <div className="foobar">
      <Foobar thing={123} />
      hello
      <HasInner>
        <b>the kids</b>
      </HasInner>
      <DoWait x={50}/>
    </div>
  )
}

export default async () => {
  const f = foobar()
  return simple_response(await render_jsx(f), 'text/html')
}
