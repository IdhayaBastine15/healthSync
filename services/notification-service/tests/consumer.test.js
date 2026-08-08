const { dispatch, HANDLERS } = require("../src/streams/handlers");

function mockIo() {
  const room = { emit: jest.fn() };
  return {
    to: jest.fn(() => room),
    emit: jest.fn(),
    __room: room,
  };
}

describe("stream event dispatch", () => {
  test("lab.result.filed emits only to the patient room", () => {
    const io = mockIo();
    const envelope = { event_type: "lab.result.filed", patient_id: "p1", result_id: "r1", is_critical: false };

    const handled = dispatch(io, "lab.result.filed", envelope);

    expect(handled).toBe(true);
    expect(io.to).toHaveBeenCalledWith("patient:p1");
    expect(io.__room.emit).toHaveBeenCalledWith("lab.result.filed", envelope);
    expect(io.emit).not.toHaveBeenCalled();
  });

  test("lab.result.critical broadcasts to everyone AND the patient room", () => {
    const io = mockIo();
    const envelope = { event_type: "lab.result.critical", patient_id: "p1", result_id: "r1", severity: "CRITICAL" };

    const handled = dispatch(io, "lab.result.critical", envelope);

    expect(handled).toBe(true);
    expect(io.emit).toHaveBeenCalledWith("lab.result.critical", envelope);
    expect(io.to).toHaveBeenCalledWith("patient:p1");
    expect(io.__room.emit).toHaveBeenCalledWith("lab.result.critical", envelope);
  });

  test("patient.record.updated emits only to the patient room", () => {
    const io = mockIo();
    const envelope = { event_type: "patient.record.updated", patient_id: "p1", updated_by: "u1" };

    dispatch(io, "patient.record.updated", envelope);

    expect(io.to).toHaveBeenCalledWith("patient:p1");
    expect(io.emit).not.toHaveBeenCalled();
  });

  test("unknown event types are ignored, not thrown", () => {
    const io = mockIo();
    const handled = dispatch(io, "some.unknown.event", { foo: "bar" });

    expect(handled).toBe(false);
    expect(io.emit).not.toHaveBeenCalled();
    expect(io.to).not.toHaveBeenCalled();
  });

  test("envelope without patient_id does not throw for room-scoped events", () => {
    const io = mockIo();
    expect(() => dispatch(io, "lab.result.filed", { event_type: "lab.result.filed" })).not.toThrow();
    expect(io.to).not.toHaveBeenCalled();
  });

  test("all documented event types have a handler", () => {
    expect(Object.keys(HANDLERS).sort()).toEqual(
      ["lab.result.critical", "lab.result.filed", "patient.record.updated"].sort()
    );
  });
});
